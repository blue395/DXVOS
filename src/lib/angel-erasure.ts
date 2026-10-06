import "server-only";
// "Delete angel" (Blue, 2026-10-01: smart delete). A record with no history is removed
// outright. A record with history keeps its place in deal totals and statement records,
// but every personal detail is erased: on the record, its login, typed names on votes and
// tickets (and their change history), statement signatures, IPs and files, notes, activity
// details, private portfolio, and bulk-email addresses. Logged without the person's name.

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { removeObject } from "./deck-storage";
import { ERASED_ANGEL_NAME, angelDeleteMode, normaliseAngelName, scrubAuditSnapshot, type AngelHistory } from "./pipeline";
import type { Prisma } from "@/generated/prisma/client";

/** The votes and tickets that belong to this angel: linked by id, or by a confirmed alias of their typed name. */
async function linkedEntries(angelId: string) {
  const aliases = await db.angelAlias.findMany({ where: { angelId }, select: { normalized: true } });
  const names = new Set(aliases.map((a) => a.normalized));
  const mine = <T extends { angelId: string | null; angelName: string }>(rows: T[]) => rows.filter((r) => r.angelId === angelId || (!r.angelId && names.has(normaliseAngelName(r.angelName))));
  const where = { OR: [{ angelId }, ...(names.size ? [{ angelId: null }] : [])] };
  const [pre, eoi, finals] = await Promise.all([
    db.preSelectionVote.findMany({ where, select: { id: true, angelId: true, angelName: true } }),
    db.investmentVote.findMany({ where, select: { id: true, angelId: true, angelName: true } }),
    db.finalInvestment.findMany({ where, select: { id: true, angelId: true, angelName: true } }),
  ]);
  return { pre: mine(pre), eoi: mine(eoi), finals: mine(finals), aliases: aliases.length };
}

export async function angelHistory(angelId: string): Promise<AngelHistory & { teamLogin: boolean }> {
  const [user, entries, certifications, holdings, emails] = await Promise.all([
    db.user.findUnique({ where: { angelId }, select: { role: true } }),
    linkedEntries(angelId),
    db.angelCertification.count({ where: { angelId } }),
    db.portfolioHolding.count({ where: { angelId } }),
    db.memberEmailRecipient.count({ where: { angelId } }),
  ]);
  return {
    login: !!user,
    teamLogin: user?.role === "ADMIN",
    votes: entries.pre.length + entries.eoi.length,
    investments: entries.finals.length,
    certifications,
    holdings,
    aliases: entries.aliases,
    emails,
  };
}

export type DeleteOutcome = { mode: "remove" | "erase" } | { error: string };

export async function deleteAngelRecord(angelId: string, actor: { id: string }): Promise<DeleteOutcome> {
  const angel = await db.angel.findUnique({ where: { id: angelId }, select: { id: true, erasedAt: true, user: { select: { id: true, role: true } } } });
  if (!angel) return { error: "Angel not found." };
  if (angel.erasedAt) return { error: "Their personal details have already been erased." };
  if (angel.user?.role === "ADMIN") {
    return { error: "This angel record is linked to a DXV team login. Revoke the team login on the Team page first, or keep the record." };
  }
  const history = await angelHistory(angelId);
  const mode = angelDeleteMode(history);

  if (mode === "remove") {
    await db.$transaction([
      db.angelInvite.deleteMany({ where: { angelId } }),
      db.angelNote.deleteMany({ where: { angelId } }),
      db.angelEvent.deleteMany({ where: { angelId } }),
      db.angel.delete({ where: { id: angelId } }),
      db.teamEvent.create({ data: { email: "angel record", kind: "angel-removed", detail: `Removed an angel record with no history (${angelId})`, actorId: actor.id } }),
    ]);
    return { mode };
  }

  const entries = await linkedEntries(angelId);
  const entryIds = [...entries.pre, ...entries.eoi, ...entries.finals].map((e) => e.id);
  const [audits, certFiles, user] = await Promise.all([
    entryIds.length ? db.entryAudit.findMany({ where: { entryId: { in: entryIds } }, select: { id: true, before: true, after: true } }) : [],
    db.angelCertification.findMany({ where: { angelId, storagePath: { not: null } }, select: { bucket: true, storagePath: true } }),
    db.user.findUnique({ where: { angelId }, select: { id: true } }),
  ]);
  const scrub = { angelName: ERASED_ANGEL_NAME, angelId, note: null };
  const now = new Date();
  const unusable = user ? await bcrypt.hash(randomBytes(32).toString("base64url"), 12) : null;

  await db.$transaction([
    // Votes and tickets keep their amounts and answers, now under the erased record.
    db.preSelectionVote.updateMany({ where: { id: { in: entries.pre.map((e) => e.id) } }, data: scrub }),
    db.investmentVote.updateMany({ where: { id: { in: entries.eoi.map((e) => e.id) } }, data: scrub }),
    db.finalInvestment.updateMany({ where: { id: { in: entries.finals.map((e) => e.id) } }, data: scrub }),
    ...audits.map((a) =>
      db.entryAudit.update({
        where: { id: a.id },
        data: { before: scrubAuditSnapshot(a.before) as Prisma.InputJsonValue, after: a.after === null ? undefined : (scrubAuditSnapshot(a.after) as Prisma.InputJsonValue) },
      }),
    ),
    db.angelAlias.deleteMany({ where: { angelId } }),
    // Statements stay as evidence (type, dates, wording version) without the person's details.
    db.angelCertification.updateMany({
      where: { angelId },
      data: { signatureName: null, ipAddress: null, note: null, bucket: null, storagePath: null, fileName: null, mimeType: null, sizeBytes: null },
    }),
    db.angelNote.deleteMany({ where: { angelId } }),
    db.angelEvent.updateMany({ where: { angelId }, data: { detail: null } }),
    db.angelInvite.updateMany({ where: { angelId, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
    db.portfolioHolding.deleteMany({ where: { angelId } }),
    db.memberEmailRecipient.updateMany({ where: { angelId }, data: { email: "erased" } }),
    ...(user
      ? [
          db.loginIdentity.deleteMany({ where: { userId: user.id } }),
          db.loginLink.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
          db.user.update({ where: { id: user.id }, data: { email: `erased-${user.id}@deleted.invalid`, name: ERASED_ANGEL_NAME, passwordHash: unusable!, disabledAt: now, sessionVersion: { increment: 1 } } }),
        ]
      : []),
    db.angel.update({
      where: { id: angelId },
      data: {
        name: ERASED_ANGEL_NAME,
        email: null,
        phone: null,
        linkedinUrl: null,
        location: null,
        bio: null,
        sectors: [],
        tags: [],
        whatsappGroups: [],
        source: null,
        ticketRange: null,
        experience: null,
        erasedAt: now,
        archivedAt: now,
        emailOptOutAt: now,
        updatedById: actor.id,
      },
    }),
    db.angelEvent.create({ data: { angelId, kind: "personal-details-erased", detail: "Deleted by the DXV team; deal records kept", actorId: actor.id } }),
    db.teamEvent.create({ data: { email: "angel record", kind: "angel-erased", detail: `Erased an angel's personal details (${angelId})`, actorId: actor.id } }),
  ]);

  // Signed statement files hold the person's name, so they go too (after the records are safe).
  for (const f of certFiles) {
    await removeObject(f.bucket ?? "documents", f.storagePath!).catch((e) => console.error("Couldn't remove a statement file", e));
  }
  return { mode };
}
