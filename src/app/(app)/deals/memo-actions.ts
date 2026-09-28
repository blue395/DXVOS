"use server";

// Server actions for the AI-assisted investment assessment.
// Flow: generate (AI draft N, background job) → start review (editable copy) →
// edit text / overrule scores (logged) → finalise (new locked MemoVersion).
// The AI suggests; partners decide. Nothing here moves a deal.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderScreen } from "@/lib/deck-ai/render";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import type { MemoContext } from "@/lib/memo-ai/context";
import { CRITERIA, type MemoContent } from "@/lib/memo-ai/schema";
import { MEMO_JOB_PREFIX, runMemoAnalysis } from "@/lib/memo-worker";
import { canGenerateAssessment, formatGbp, PASS_REASON_LABELS } from "@/lib/pipeline";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import type { ActionResult } from "@/lib/action-result";

function revalidateAssessment(ventureId: string) {
  revalidatePath(`/deals/${ventureId}`);
  revalidatePath(`/deals/${ventureId}/assessment`);
}

// ── Generate an AI draft ────────────────────────────────────────────────────

export async function generateAssessment(ventureId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const v = await db.venture.findUnique({
    where: { id: ventureId },
    include: {
      deckAnalyses: { orderBy: { createdAt: "desc" } },
      eligibilityReviews: { orderBy: { decidedAt: "asc" }, include: { decidedBy: { select: { name: true } } } },
      founderComms: { where: { note: { not: null } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!v) return { error: "Venture not found." };
  if (!canGenerateAssessment(v.currentStage)) {
    return { error: "The AI assessment is available from DXV Partner Review onwards." };
  }
  if (await db.memoAnalysis.findFirst({ where: { ventureId, status: { in: ["PENDING", "PROCESSING"] } } })) {
    return { error: "An assessment is already being drafted." };
  }

  // The stored deck: any upload that finished (PENDING means the upload never completed).
  const deck = v.deckAnalyses.find((a) => a.status !== "PENDING");
  if (!deck) return { error: "No deck is stored for this venture. Upload one on the Eligibility screen card first." };
  const screen = v.deckAnalyses.find((a) => a.status === "COMPLETE")?.screen as EligibilityScreen | undefined;

  const context: MemoContext = {
    ventureName: v.name,
    dxvRound: v.round ? `Round ${v.round}` : "Not assigned",
    details: {
      Founders: v.founderNames,
      Sector: v.sector,
      "Company stage": v.companyStage,
      Raising: v.raiseAmountGbp ? formatGbp(v.raiseAmountGbp) : null,
      Website: v.website,
      Description: v.description,
    },
    eligibilityScreen: screen ? renderScreen(screen) : null,
    eligibilityDecisions: v.eligibilityReviews.map(
      (r) =>
        `${r.decision.replace(/_/g, " ").toLowerCase()} (${r.decidedBy.name})` +
        (r.passReason ? `, reason: ${PASS_REASON_LABELS[r.passReason]}` : "") +
        (r.note ? `: ${r.note}` : ""),
    ),
    founderCommsNotes: v.founderComms.map((c) => `${c.decision}: ${c.note}`),
    deck: { storagePath: deck.storagePath, fileName: deck.fileName },
  };

  const analysis = await db.$transaction(async (tx) => {
    const last = await tx.memoAnalysis.findFirst({ where: { ventureId }, orderBy: { number: "desc" } });
    return tx.memoAnalysis.create({
      data: { ventureId, number: (last?.number ?? 0) + 1, context, createdById: user.id },
    });
  });

  const started = await triggerBackgroundJob({
    functionName: "analyze-memo-background",
    subject: `${MEMO_JOB_PREFIX}${analysis.id}`,
    runInline: () => runMemoAnalysis(analysis.id),
  });
  if (!started) {
    await db.memoAnalysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() },
    });
  }
  revalidateAssessment(ventureId);
  return { ok: true };
}

// ── Review: an editable copy of an AI draft ─────────────────────────────────

export async function startReview(analysisId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const analysis = await db.memoAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis || analysis.status !== "COMPLETE" || !analysis.output) return { error: "That AI draft isn't ready." };

  await db.$transaction([
    // Restarting archives the current working copy (kept, with its score log).
    db.memoDraft.updateMany({ where: { ventureId: analysis.ventureId, archivedAt: null }, data: { archivedAt: new Date() } }),
    db.memoDraft.create({
      data: { ventureId: analysis.ventureId, analysisId, content: analysis.output, createdById: user.id },
    }),
  ]);
  revalidateAssessment(analysis.ventureId);
  return { ok: true };
}

async function loadOpenDraft(draftId: string) {
  const draft = await db.memoDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.archivedAt) return null;
  return { ...draft, content: draft.content as MemoContent };
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
const commaList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const TextSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  round: z.string().trim(),
  stage: z.string().trim(),
  businessModel: z.string().trim(),
  sdgs: z.string(),
  impactThesis: z.string().trim(),
  impactThemes: z.string(),
  diversityThemes: z.string(),
  executiveSummary: z.string().trim(),
  investmentCase: z.string(),
  conclusion: z.string().trim(),
  strengths: z.string(),
  weaknesses: z.string(),
  opportunities: z.string(),
  threats: z.string(),
  followUpQuestions: z.string(),
});

/** Save every text section of the working copy (scores are edited separately). */
export async function saveMemoText(draftId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = TextSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const draft = await loadOpenDraft(draftId);
  if (!draft) return { error: "This review copy is no longer open." };
  const f = parsed.data;

  const content: MemoContent = {
    ...draft.content,
    header: {
      businessName: f.businessName,
      round: f.round,
      stage: f.stage,
      businessModel: f.businessModel,
      sdgs: lines(f.sdgs),
      impactThesis: f.impactThesis,
      impactThemes: commaList(f.impactThemes),
      diversityThemes: commaList(f.diversityThemes),
    },
    executiveSummary: f.executiveSummary,
    investmentCase: lines(f.investmentCase),
    conclusion: f.conclusion,
    swot: {
      strengths: lines(f.strengths),
      weaknesses: lines(f.weaknesses),
      opportunities: lines(f.opportunities),
      threats: lines(f.threats),
    },
    followUpQuestions: lines(f.followUpQuestions),
  };
  await db.memoDraft.update({ where: { id: draftId }, data: { content, updatedById: user.id } });
  revalidateAssessment(draft.ventureId);
  return { ok: true };
}

const ScoreFormSchema = z.object({
  criterion: z.enum(CRITERIA),
  score: z.coerce.number().int().min(1).max(5),
  justification: z.string().trim().min(1, "Add a justification"),
  reason: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .optional(),
});

/** Overrule one score (and/or its justification) without re-running the assessment. Logged. */
export async function saveMemoScore(draftId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = ScoreFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const draft = await loadOpenDraft(draftId);
  if (!draft) return { error: "This review copy is no longer open." };
  const { criterion, score, justification, reason } = parsed.data;

  const current = draft.content.scores.find((s) => s.criterion === criterion);
  if (!current) return { error: "Unknown criterion." };
  if (current.score === score && current.justification === justification) return { ok: true };

  const content: MemoContent = {
    ...draft.content,
    scores: draft.content.scores.map((s) => (s.criterion === criterion ? { criterion, score, justification } : s)),
  };
  await db.$transaction([
    db.memoDraft.update({ where: { id: draftId }, data: { content, updatedById: user.id } }),
    db.memoScoreChange.create({
      data: { draftId, criterion, fromScore: current.score, toScore: score, justification, reason: reason ?? null, changedById: user.id },
    }),
  ]);
  revalidateAssessment(draft.ventureId);
  return { ok: true };
}

// ── Finalise: a locked, reviewed memo version for the syndicate ─────────────

export async function finaliseMemo(draftId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const draft = await loadOpenDraft(draftId);
  if (!draft) return { error: "This review copy is no longer open." };
  const note = String(formData.get("summary") ?? "").trim();
  const analysis = await db.memoAnalysis.findUnique({ where: { id: draft.analysisId }, select: { number: true } });

  await db.$transaction(async (tx) => {
    const latest = await tx.memoVersion.findFirst({ where: { ventureId: draft.ventureId }, orderBy: { version: "desc" } });
    await tx.memoVersion.create({
      data: {
        ventureId: draft.ventureId,
        version: (latest?.version ?? 0) + 1,
        kind: "REVIEWED_MEMO",
        content: draft.content,
        sourceAnalysisId: draft.analysisId,
        summary: note || `Reviewed memo from AI draft ${analysis?.number ?? ""}`.trim(),
        createdById: user.id,
      },
    });
  });
  revalidateAssessment(draft.ventureId);
  return { ok: true };
}
