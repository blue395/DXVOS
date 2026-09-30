// The deal room's data: the ONLY place the portal reads deals. Every query starts from
// "shared with angels and at a stage angels may see" and returns just the fields
// members are allowed (rules in pipeline.ts). Never eligibility screens, AI output,
// working drafts, internal notes, votes by others, or declined deals.
import "server-only";
import { db } from "@/lib/db";
import type { Angel } from "@/generated/prisma/client";
import type { DocumentCategory, Stage } from "@/generated/prisma/enums";
import { aliasMap } from "@/lib/angels";
import {
  angelDdOpen,
  angelDealVisibility,
  angelSeesDocument,
  angelSeesMemo,
  angelVoteKind,
  canSeeLiveDeals,
  committedAngelIds,
  latestCertification,
  memberBoardCards,
  memberCardOneLiner,
  nextOnboardingStep,
  type AngelDealPhase,
} from "@/lib/pipeline";
import { issueNumbers, reviewIssueName } from "@/lib/memo-ai/render";
import { memoSpec } from "@/lib/export/documents";
import { formatLongDate, type DocSpec } from "@/lib/export/spec";
import type { MemoContent } from "@/lib/memo-ai/schema";

/** Stages at which a shared deal can be seen at all (see angelDealPhase). */
const VISIBLE_STAGES: Stage[] = ["PITCH_SELECTION", "PITCH_OUTCOME", "INVESTMENT_COMMITMENTS", "DUE_DILIGENCE", "INVESTMENT_COMPLETE", "SEIS_CERTIFICATE"];

/** May this angel see deals right now? Onboarded, a current investor statement, and not "neither applies". */
export async function angelHasDealAccess(angel: Pick<Angel, "id" | "status" | "archivedAt" | "restrictedDeclaredAt" | "profileConfirmedAt" | "onboardedAt">) {
  const certs = await db.angelCertification.findMany({ where: { angelId: angel.id }, select: { signedOn: true, expiresOn: true } });
  const cert = latestCertification(certs);
  return nextOnboardingStep(angel, cert) === "done" && !angel.restrictedDeclaredAt && canSeeLiveDeals(angel, cert);
}

export type DealListItem = {
  id: string;
  name: string;
  sector: string | null;
  phase: AngelDealPhase;
  sharedAt: Date;
  /** What this angel can record now (pitch selection vote or EOI), if anything. */
  voteKind: "pre-selection" | "eoi" | null;
  /** This angel's latest answer for that vote (null: not answered yet, or no angel given). */
  myAnswer: { interested: boolean; maxTicketGbp: number | null } | null;
  /** The deal's current pitch deck (the same one the deal room shows), for one-click viewing. */
  deck: { id: string; fileName: string; mimeType: string } | null;
};

/** Every deal members can see now, newest share first; with `angelId`, that angel's own vote status on each. */
export async function listSharedDeals(angelId: string | null = null): Promise<DealListItem[]> {
  const rows = await db.venture.findMany({
    where: { sharedWithAngelsAt: { not: null }, currentStage: { in: VISIBLE_STAGES } },
    orderBy: { sharedWithAngelsAt: "desc" },
    select: {
      id: true,
      name: true,
      sector: true,
      currentStage: true,
      sharedWithAngelsAt: true,
      preSelectionVotes: angelId ? { where: { angelId }, orderBy: { createdAt: "desc" }, take: 1, select: { interested: true } } : false,
      investmentVotes: angelId
        ? { where: { angelId, removedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { interested: true, maxTicketGbp: true } }
        : false,
      // The latest uploaded deck (members see it from Member Pitch Selection on, like the deal room).
      documents: {
        where: { category: "DECK", uploadedAt: { not: null }, archivedAt: null },
        orderBy: { uploadedAt: "desc" },
        take: 1,
        select: { id: true, fileName: true, mimeType: true },
      },
    },
  });
  return rows.flatMap((v) => {
    const phase = angelDealVisibility(v);
    if (!phase) return [];
    const voteKind = angelVoteKind(v.currentStage);
    const pre = v.preSelectionVotes?.[0];
    const eoi = v.investmentVotes?.[0];
    const myAnswer =
      voteKind === "pre-selection" && pre ? { interested: pre.interested, maxTicketGbp: null } : voteKind === "eoi" && eoi ? { interested: eoi.interested, maxTicketGbp: eoi.maxTicketGbp } : null;
    return [{ id: v.id, name: v.name, sector: v.sector, phase, sharedAt: v.sharedWithAngelsAt!, voteKind, myAnswer, deck: v.documents[0] ?? null }];
  });
}

/** The round DXV has opened to members' deals board (set on the Dashboard; null = none). */
export async function currentMemberRound(): Promise<number | null> {
  const latest = await db.memberRound.findFirst({ orderBy: { createdAt: "desc" }, select: { round: true } });
  return latest?.round ?? null;
}

export type MemberBoardCard = {
  id: string;
  name: string;
  sector: string | null;
  companyStage: string | null;
  round: number | null;
  raiseAmountGbp: number | null;
  /** Written for members (never the AI screen or internal description): memberCardOneLiner(). */
  oneLiner: string | null;
  column: Stage;
  phase: AngelDealPhase | null;
};

/**
 * The members' read-only board: the offered round's live deals, name and sector only.
 * Only cards with a phase open into the deal room (shared, from Member Pitch Selection).
 */
export async function loadMemberBoard(): Promise<{ round: number | null; cards: MemberBoardCard[] }> {
  const round = await currentMemberRound();
  if (round === null) return { round, cards: [] };
  const rows = await db.venture.findMany({
    where: { round, currentStage: { not: "PASSED" } },
    orderBy: { stageEnteredAt: "asc" },
    select: {
      id: true,
      name: true,
      sector: true,
      companyStage: true,
      raiseAmountGbp: true,
      round: true,
      currentStage: true,
      sharedWithAngelsAt: true,
      angelSummary: true,
      memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" }, take: 1, select: { content: true } },
    },
  });
  return {
    round,
    cards: memberBoardCards(rows, round).map((c) => {
      const memo = c.memoVersions[0]?.content as { executiveSummary?: unknown } | null | undefined;
      return {
        id: c.id,
        name: c.name,
        sector: c.sector,
        companyStage: c.companyStage,
        round: c.round,
        raiseAmountGbp: c.raiseAmountGbp,
        oneLiner: memberCardOneLiner({
          angelSummary: c.angelSummary,
          memoSummary: typeof memo?.executiveSummary === "string" ? memo.executiveSummary : null,
          phase: c.phase,
        }),
        column: c.column,
        phase: c.phase,
      };
    }),
  };
}

export type DealRoomDoc = { id: string; fileName: string; mimeType: string; sizeBytes: number; category: DocumentCategory; uploadedAt: Date | null };

export type DealRoom = {
  id: string;
  name: string;
  sector: string | null;
  companyStage: string | null;
  raiseAmountGbp: number | null;
  website: string | null;
  summary: string | null;
  phase: AngelDealPhase;
  deck: DealRoomDoc | null;
  memo: { id: string; name: string; spec: DocSpec } | null;
  documents: DealRoomDoc[];
  /** Due-diligence documents: only for members who committed, once DD has started. */
  ddDocuments: DealRoomDoc[];
  /** DD has started on this deal (whether or not this angel committed). */
  ddOpen: boolean;
  committed: boolean;
  voteKind: "pre-selection" | "eoi" | null;
  myPreSelection: { interested: boolean; note: string | null; createdAt: Date } | null;
  myEoi: { interested: boolean; maxTicketGbp: number; note: string | null; createdAt: Date } | null;
};

const docSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  uploadedAt: true,
  archivedAt: true,
  angelVisibleFrom: true,
  ddReportJob: { select: { id: true } }, // AI-generated DD reports are never shown to members
} as const;

/**
 * One deal as members see it, or null if they can't see it. `angelId` loads that
 * angel's own votes and whether they committed (null for the team's preview, which can
 * ask to see it as a committed member).
 */
export async function loadDealRoom(ventureId: string, angelId: string | null, opts: { previewCommitted?: boolean } = {}): Promise<DealRoom | null> {
  const [v, eois, finals, aliases] = await Promise.all([
    db.venture.findUnique({
      where: { id: ventureId },
      select: {
        id: true,
        name: true,
        sector: true,
        companyStage: true,
        raiseAmountGbp: true,
        website: true,
        angelSummary: true,
        currentStage: true,
        sharedWithAngelsAt: true,
        documents: { where: { uploadedAt: { not: null }, archivedAt: null }, orderBy: { uploadedAt: "desc" }, select: docSelect },
        memoVersions: {
          where: { kind: "REVIEWED_MEMO" },
          orderBy: { version: "desc" },
          select: { id: true, version: true, content: true, createdAt: true },
        },
        preSelectionVotes: angelId
          ? { where: { angelId }, orderBy: { createdAt: "desc" }, take: 1, select: { interested: true, note: true, createdAt: true } }
          : false,
        investmentVotes: angelId
          ? { where: { angelId, removedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { interested: true, maxTicketGbp: true, note: true, createdAt: true } }
          : false,
      },
    }),
    // Who committed (read here, never returned): their latest EOI on this deal, or a final ticket.
    angelId ? db.investmentVote.findMany({ where: { ventureId, removedAt: null }, select: { angelId: true, angelName: true, interested: true, createdAt: true } }) : [],
    angelId ? db.finalInvestment.findMany({ where: { ventureId, removedAt: null }, select: { angelId: true, angelName: true } }) : [],
    angelId ? aliasMap() : new Map<string, string>(),
  ]);
  if (!v) return null;
  const phase = angelDealVisibility(v);
  if (!phase) return null;
  const committed = angelId ? committedAngelIds(eois, finals, aliases).has(angelId) : !!opts.previewCommitted;
  const dd = { open: angelDdOpen(v.currentStage), committed };

  const strip = (d: (typeof v.documents)[number]): DealRoomDoc => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    category: d.category,
    uploadedAt: d.uploadedAt,
  });
  const deck = v.documents.find((d) => d.category === "DECK") ?? null;
  const shareable = v.documents.filter((d) => d.id !== deck?.id && !d.ddReportJob && angelSeesDocument(phase, d, dd));
  const documents = shareable.filter((d) => d.angelVisibleFrom !== "DUE_DILIGENCE").map(strip);
  const ddDocuments = shareable.filter((d) => d.angelVisibleFrom === "DUE_DILIGENCE").map(strip);

  // The latest locked DXV Review Issue (never AI drafts or working drafts).
  let memo: DealRoom["memo"] = null;
  const issue = v.memoVersions.find((m) => m.content);
  if (angelSeesMemo(phase) && issue) {
    const name = reviewIssueName(issueNumbers(v.memoVersions).get(issue.id)!);
    const footer = `${name}, issued by DXV on ${formatLongDate(issue.createdAt)}. Confidential: for DXV members considering this investment.`;
    memo = { id: issue.id, name, spec: memoSpec(issue.content as MemoContent, { name, ventureName: v.name, banner: false, footer, date: issue.createdAt }) };
  }

  return {
    id: v.id,
    name: v.name,
    sector: v.sector,
    companyStage: v.companyStage,
    raiseAmountGbp: v.raiseAmountGbp,
    website: v.website,
    summary: v.angelSummary,
    phase,
    deck: deck && strip(deck),
    memo,
    documents,
    ddDocuments,
    ddOpen: dd.open,
    committed,
    voteKind: angelVoteKind(v.currentStage),
    myPreSelection: v.preSelectionVotes?.[0] ?? null,
    myEoi: v.investmentVotes?.[0] ?? null,
  };
}

/** Whether this angel may open this document: the deal's current deck, or a document shared with them for the deal's phase. */
export async function angelMayOpenDocument(documentId: string, angelId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { ventureId: true } });
  if (!doc) return null;
  const room = await loadDealRoom(doc.ventureId, angelId);
  if (!room) return null;
  const ok = room.deck?.id === documentId || [...room.documents, ...room.ddDocuments].some((d) => d.id === documentId);
  return ok ? { ventureId: doc.ventureId, ventureName: room.name } : null;
}

/** The members who could open a shared deal right now (signed up, onboarded, statement current). For the team's view. */
export async function angelIdsWithDealAccess(now = new Date()): Promise<Set<string>> {
  const angels = await db.angel.findMany({
    where: { status: "MEMBER", archivedAt: null, onboardedAt: { not: null }, restrictedDeclaredAt: null, user: { is: { disabledAt: null } } },
    select: { id: true, status: true, archivedAt: true, certifications: { select: { signedOn: true, expiresOn: true } } },
  });
  return new Set(angels.filter((a) => canSeeLiveDeals(a, latestCertification(a.certifications), now)).map((a) => a.id));
}
