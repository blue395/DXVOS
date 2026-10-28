// The deals still needing an investment assessment (Dashboard tile and its list).
import "server-only";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { ASSESSMENT_STAGES, assessmentStatus, type AssessmentStatus } from "@/lib/pipeline";
import type { Stage } from "@/generated/prisma/enums";

export type AssessmentQueueRow = {
  id: string;
  name: string;
  oneLiner: string | null;
  currentStage: Stage;
  round: number | null;
  stageEnteredAt: Date;
  status: AssessmentStatus;
};

/** One query: deals at an assessment stage with no DXV Review Issue, and where their assessment stands. */
export async function loadAssessmentQueue(): Promise<AssessmentQueueRow[]> {
  const rows = await db.venture.findMany({
    where: { currentStage: { in: [...ASSESSMENT_STAGES] } },
    orderBy: { stageEnteredAt: "asc" },
    select: {
      id: true,
      name: true,
      oneLiner: true,
      currentStage: true,
      round: true,
      stageEnteredAt: true,
      memoVersions: { where: { kind: "REVIEWED_MEMO" }, take: 1, select: { id: true } },
      memoDrafts: { where: { archivedAt: null }, take: 1, select: { id: true } },
      memoAnalyses: { orderBy: { number: "desc" }, take: 3, select: { status: true, error: true, createdAt: true, startedAt: true } },
    },
  });
  return rows.flatMap((v) => {
    const status = assessmentStatus({
      currentStage: v.currentStage,
      issued: v.memoVersions.length > 0,
      hasReviewDraft: v.memoDrafts.length > 0,
      aiDrafts: v.memoAnalyses.map((a) => effectiveDeckStatus(a)),
    });
    return status
      ? [{ id: v.id, name: v.name, oneLiner: v.oneLiner, currentStage: v.currentStage, round: v.round, stageEnteredAt: v.stageEnteredAt, status }]
      : [];
  });
}
