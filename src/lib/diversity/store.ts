import "server-only";
// The ONLY code that touches the diversity tables (a test enforces it). Every operation
// runs in one transaction under a least-privilege database role:
//   dxv_member: the signed-in member's own rows (dxv.angel_id set for the transaction);
//   dxv_diversity_system: retention jobs and account erasure;
//   dxv_diversity_admin: only the two functions (counts; one member's answers, logged).
// The app's own role sees nothing in these tables (FORCEd row-level security).
// Never log, email, put in a URL or send to AI anything read here: errors are logged as a
// fixed message and a code only (Prisma messages can echo the values sent).

import { Prisma } from "@/generated/prisma/client";
import type { ConsentMethod } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { CONSENT_VERSION } from "./consent-v1";
import {
  DIVERSITY_CATEGORIES,
  byCategory,
  parseDiversityForm,
  planDiversitySave,
  type DiversityAnswerInput,
  type DiversityCategory,
} from "./questions";

type Tx = Prisma.TransactionClient;
type Scope = { role: "dxv_member"; angelId: string } | { role: "dxv_diversity_system" } | { role: "dxv_diversity_admin" };

async function scoped<T>(scope: Scope, what: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${scope.role}`); // fixed names only, never user input
      if (scope.role === "dxv_member") await tx.$executeRaw`SELECT set_config('dxv.angel_id', ${scope.angelId}, true)`;
      return fn(tx);
    });
  } catch (e) {
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : e instanceof Error ? e.name : "unknown";
    console.error(`[diversity] ${what} failed (${code})`); // deliberately no message, values or ids
    throw new DiversityError(what);
  }
}

/** A diversity operation failed. Carries no data from the database. */
export class DiversityError extends Error {
  constructor(what: string) {
    super(`Diversity information: ${what} failed`);
    this.name = "DiversityError";
  }
}

async function subjectFor(tx: Tx, angelId: string, create: boolean): Promise<string | null> {
  const s = await tx.diversitySubject.findUnique({ where: { angelId }, select: { id: true } });
  if (s || !create) return s?.id ?? null;
  return (await tx.diversitySubject.create({ data: { angelId }, select: { id: true } })).id;
}

export type MyDiversity = {
  answers: (DiversityAnswerInput & { category: DiversityCategory })[];
  consents: { category: DiversityCategory; status: "given" | "withdrawn"; wordingVersion: string; givenAt: Date; withdrawnAt: Date | null; method: ConsentMethod }[];
  history: { category: DiversityCategory; action: "given" | "withdrawn"; wordingVersion: string; method: ConsentMethod; at: Date }[];
  /** Carried over from the old "About you" pills, not yet confirmed (never used). */
  pending: (DiversityAnswerInput & { category: DiversityCategory })[];
  pendingExpiresAt: Date | null;
};

/** The signed-in member's own diversity information. */
export function loadMyDiversity(angelId: string): Promise<MyDiversity> {
  return scoped({ role: "dxv_member", angelId }, "load", async (tx) => {
    const subjectId = await subjectFor(tx, angelId, false);
    if (!subjectId) return { answers: [], consents: [], history: [], pending: [], pendingExpiresAt: null };
    const [answers, consents, history, pending] = await Promise.all([
      tx.diversityAnswer.findMany({ where: { subjectId }, select: { category: true, question: true, value: true, selfDescribed: true }, orderBy: [{ question: "asc" }, { value: "asc" }] }),
      tx.diversityConsent.findMany({ where: { subjectId }, select: { category: true, status: true, wordingVersion: true, givenAt: true, withdrawnAt: true, method: true } }),
      tx.diversityConsentLog.findMany({ where: { subjectId }, select: { category: true, action: true, wordingVersion: true, method: true, at: true }, orderBy: { at: "desc" } }),
      tx.diversityPending.findMany({ where: { subjectId }, select: { category: true, question: true, value: true, expiresAt: true } }),
    ]);
    return {
      answers,
      consents,
      history,
      pending: pending.map((p) => ({ category: p.category, question: p.question, value: p.value, selfDescribed: false })),
      pendingExpiresAt: pending.length ? pending.reduce((m, p) => (p.expiresAt < m ? p.expiresAt : m), pending[0].expiresAt) : null,
    };
  });
}

export type SaveOutcome = { saved: DiversityCategory[]; refused: DiversityCategory[]; withdrawn: DiversityCategory[] };

/**
 * Save the consent form. Per category: an answer is written only together with its given
 * consent, in this one transaction (and the database refuses an answer without one);
 * an answer without its box is not saved; clearing a category deletes its answers and
 * withdraws consent. Carried-over (pending) answers are cleared: the member has now chosen.
 */
export async function saveMyDiversity(angelId: string, form: FormData, method: ConsentMethod): Promise<SaveOutcome> {
  const { answers, consented } = parseDiversityForm(form);
  return scoped({ role: "dxv_member", angelId }, "save", async (tx) => {
    const subjectId = (await subjectFor(tx, angelId, true))!;
    const [savedRows, consentRows] = await Promise.all([
      tx.diversityAnswer.findMany({ where: { subjectId }, select: { category: true, question: true, value: true, selfDescribed: true } }),
      tx.diversityConsent.findMany({ where: { subjectId }, select: { category: true, status: true } }),
    ]);
    const given = new Set(consentRows.filter((c) => c.status === "given").map((c) => c.category));
    const plan = planDiversitySave(answers, consented, byCategory(savedRows), given);
    const out: SaveOutcome = { saved: [], refused: [], withdrawn: [] };
    const now = new Date();
    for (const category of DIVERSITY_CATEGORIES) {
      const p = plan[category];
      if (p === "save") {
        await tx.diversityConsent.upsert({
          where: { subjectId_category: { subjectId, category } },
          create: { subjectId, category, status: "given", wordingVersion: CONSENT_VERSION, givenAt: now, method },
          update: { status: "given", wordingVersion: CONSENT_VERSION, givenAt: now, withdrawnAt: null, method },
        });
        await tx.diversityConsentLog.create({ data: { subjectId, category, action: "given", wordingVersion: CONSENT_VERSION, method } });
        await tx.diversityAnswer.deleteMany({ where: { subjectId, category } });
        await tx.diversityAnswer.createMany({ data: answers[category]!.map((a) => ({ subjectId, category, ...a })) });
        out.saved.push(category);
      } else if (p === "withdraw") {
        await withdraw(tx, subjectId, category, method, now);
        out.withdrawn.push(category);
      } else if (p === "refuse") {
        out.refused.push(category);
      }
    }
    await tx.diversityPending.deleteMany({ where: { subjectId } });
    return out;
  });
}

async function withdraw(tx: Tx, subjectId: string, category: DiversityCategory, method: ConsentMethod, at: Date) {
  const c = await tx.diversityConsent.findUnique({ where: { subjectId_category: { subjectId, category } }, select: { status: true, wordingVersion: true } });
  if (c?.status === "given") {
    // The database deletes the category's answers when consent is withdrawn (trigger).
    await tx.diversityConsent.update({ where: { subjectId_category: { subjectId, category } }, data: { status: "withdrawn", withdrawnAt: at, method } });
    await tx.diversityConsentLog.create({ data: { subjectId, category, action: "withdrawn", wordingVersion: c.wordingVersion, method } });
  }
  await tx.diversityAnswer.deleteMany({ where: { subjectId, category } });
}

/** "Remove my diversity information": every answer deleted, every consent withdrawn (logged), carried-over answers gone. */
export function withdrawAllMyDiversity(angelId: string, method: ConsentMethod = "profile_edit"): Promise<number> {
  return scoped({ role: "dxv_member", angelId }, "withdraw", async (tx) => {
    const subjectId = await subjectFor(tx, angelId, false);
    if (!subjectId) return 0;
    const given = await tx.diversityConsent.findMany({ where: { subjectId, status: "given" }, select: { category: true } });
    const now = new Date();
    for (const { category } of given) await withdraw(tx, subjectId, category, method, now);
    await tx.diversityPending.deleteMany({ where: { subjectId } });
    return given.length;
  });
}

/** Everything held for this member, for "Download my data" (their own data only). */
export async function exportMyDiversity(angelId: string) {
  const d = await loadMyDiversity(angelId);
  return {
    answers: d.answers,
    consents: d.consents,
    consentHistory: d.history,
    carriedOverAnswersAwaitingConfirmation: d.pending,
  };
}

// ── System jobs ────────────────────────────────────────────────────────────

/** Account erasure: answers and carried-over answers deleted, consents withdrawn (records kept, per retention). */
export function eraseDiversityForAngel(angelId: string, method: ConsentMethod): Promise<void> {
  return scoped({ role: "dxv_diversity_system" }, "erase", async (tx) => {
    const s = await tx.diversitySubject.findUnique({ where: { angelId }, select: { id: true } });
    if (!s) return;
    const given = await tx.diversityConsent.findMany({ where: { subjectId: s.id, status: "given" }, select: { category: true } });
    const now = new Date();
    for (const { category } of given) await withdraw(tx, s.id, category, method, now);
    await tx.diversityPending.deleteMany({ where: { subjectId: s.id } });
  });
}

/** Retention (docs/privacy/launch-pack.md): returns how many members / rows each rule touched. */
export function runDiversityRetention(now = new Date()) {
  return scoped({ role: "dxv_diversity_system" }, "retention", async (tx) => {
    const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
    const sixYearsAgo = new Date(now.getTime() - 6 * 365 * 86_400_000);
    // Answers of members who left (archived / erased) or haven't been active for 12 months.
    const stale = await tx.diversitySubject.findMany({
      where: {
        consents: { some: { status: "given" } },
        OR: [
          { angelId: null },
          { angel: { OR: [{ archivedAt: { not: null } }, { erasedAt: { not: null } }] } },
          { angel: { AND: [{ OR: [{ user: { is: null } }, { user: { is: { OR: [{ lastSignInAt: null }, { lastSignInAt: { lt: yearAgo } }] } } }] }, { portalViews: { none: { createdAt: { gte: yearAgo } } } }, { updatedAt: { lt: yearAgo } }] } },
        ],
      },
      select: { id: true },
    });
    for (const s of stale) {
      const given = await tx.diversityConsent.findMany({ where: { subjectId: s.id, status: "given" }, select: { category: true } });
      for (const { category } of given) await withdraw(tx, s.id, category, "retention", now);
    }
    const pending = await tx.diversityPending.deleteMany({ where: { expiresAt: { lt: now } } });
    // Consent records: kept for the life of the related data plus six years.
    const oldConsents = await tx.diversityConsent.deleteMany({ where: { status: "withdrawn", withdrawnAt: { lt: sixYearsAgo } } });
    const oldLog = await tx.diversityConsentLog.deleteMany({ where: { at: { lt: sixYearsAgo } } });
    const oldAccess = await tx.diversityAccessLog.deleteMany({ where: { at: { lt: sixYearsAgo } } });
    return { staleMembers: stale.length, pendingDeleted: pending.count, consentsDeleted: oldConsents.count, logRowsDeleted: oldLog.count + oldAccess.count };
  });
}

// ── Admin: the only ways in ────────────────────────────────────────────────

export type RawCount = { question: string; value: string; selfDescribed: boolean; n: number; respondents: number };

/** Raw counts for the aggregate report. ONLY report.ts may use these (small-number rule). */
export function rawDiversityCounts(): Promise<RawCount[]> {
  return scoped({ role: "dxv_diversity_admin" }, "counts", async (tx) => {
    const rows = await tx.$queryRaw<{ question: string; value: string; self_described: boolean; n: bigint; respondents: bigint }[]>`SELECT * FROM dxv_diversity_counts()`;
    return rows.map((r) => ({ question: r.question, value: r.value, selfDescribed: r.self_described, n: Number(r.n), respondents: Number(r.respondents) }));
  });
}

/** One member's answers, for a named partner with a reason. The database logs every call. */
export function viewMemberDiversity(angelId: string, viewerId: string, reason: string) {
  return scoped({ role: "dxv_diversity_admin" }, "view", async (tx) => {
    const rows = await tx.$queryRaw<{ category: DiversityCategory; question: string; value: string; self_described: boolean; consent_given_at: Date }[]>`
      SELECT * FROM dxv_diversity_for_angel(${angelId}, ${viewerId}, ${reason})`;
    return rows.map((r) => ({ category: r.category, question: r.question, value: r.value, selfDescribed: r.self_described, consentGivenAt: r.consent_given_at }));
  });
}
