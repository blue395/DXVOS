// The deal room's data: the ONLY place the portal reads deals. Every query starts from
// "shared with angels and at a stage angels may see" and returns just the fields
// members are allowed (rules in pipeline.ts). Never eligibility screens, AI output,
// working drafts, internal notes, votes by others, or declined deals.
import "server-only";
import { db } from "@/lib/db";
import type { Angel } from "@/generated/prisma/client";
import type { DocumentCategory, Stage } from "@/generated/prisma/enums";
import {
  angelDealVisibility,
  angelSeesDocument,
  angelSeesMemo,
  angelVoteKind,
  canSeeLiveDeals,
  latestCertification,
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

export type DealListItem = { id: string; name: string; sector: string | null; phase: AngelDealPhase; sharedAt: Date };

/** Every deal members can see now, newest share first. */
export async function listSharedDeals(): Promise<DealListItem[]> {
  const rows = await db.venture.findMany({
    where: { sharedWithAngelsAt: { not: null }, currentStage: { in: VISIBLE_STAGES } },
    orderBy: { sharedWithAngelsAt: "desc" },
    select: { id: true, name: true, sector: true, currentStage: true, sharedWithAngelsAt: true },
  });
  return rows.flatMap((v) => {
    const phase = angelDealVisibility(v);
    return phase ? [{ id: v.id, name: v.name, sector: v.sector, phase, sharedAt: v.sharedWithAngelsAt! }] : [];
  });
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
 * angel's own votes (null for the team's preview).
 */
export async function loadDealRoom(ventureId: string, angelId: string | null): Promise<DealRoom | null> {
  const v = await db.venture.findUnique({
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
  });
  if (!v) return null;
  const phase = angelDealVisibility(v);
  if (!phase) return null;

  const strip = (d: (typeof v.documents)[number]): DealRoomDoc => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    category: d.category,
    uploadedAt: d.uploadedAt,
  });
  const deck = v.documents.find((d) => d.category === "DECK") ?? null;
  const documents = v.documents.filter((d) => d.id !== deck?.id && !d.ddReportJob && angelSeesDocument(phase, d)).map(strip);

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
    voteKind: angelVoteKind(v.currentStage),
    myPreSelection: v.preSelectionVotes?.[0] ?? null,
    myEoi: v.investmentVotes?.[0] ?? null,
  };
}

/** Whether this angel may open this document: the deal's current deck, or a document shared for the deal's phase. */
export async function angelMayOpenDocument(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { ventureId: true, ...docSelect } });
  if (!doc) return null;
  const room = await loadDealRoom(doc.ventureId, null);
  if (!room) return null;
  const ok = room.deck?.id === doc.id || room.documents.some((d) => d.id === doc.id);
  return ok ? { ventureId: doc.ventureId, ventureName: room.name } : null;
}

/** How many members could open a shared deal right now (signed up, onboarded, statement current). For the team's view. */
export async function countAngelsWithDealAccess(now = new Date()): Promise<number> {
  const angels = await db.angel.findMany({
    where: { status: "MEMBER", archivedAt: null, onboardedAt: { not: null }, restrictedDeclaredAt: null, user: { is: { disabledAt: null } } },
    select: { status: true, archivedAt: true, certifications: { select: { signedOn: true, expiresOn: true } } },
  });
  return angels.filter((a) => canSeeLiveDeals(a, latestCertification(a.certifications), now)).length;
}
