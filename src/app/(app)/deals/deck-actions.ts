"use server";

// Server actions for AI deck reading and the human eligibility decision.
// Flow: startDeckUpload → (browser uploads the PDF) → beginDeckAnalysis →
// background worker → getDeckAnalysisStatus (polled) → human decides.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EligibilityDecision, PassReason } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { aiContextFor } from "@/lib/playbook/current";
import { db } from "@/lib/db";
import { createUploadTarget, deckPath, MAX_DECK_BYTES, type UploadTarget } from "@/lib/deck-storage";
import { runDeckAnalysis } from "@/lib/deck-worker";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import { recordDeckDocument } from "@/lib/deck-documents";
import { effectiveDeckStatus, type DeckStatus } from "@/lib/deck-status";
import { canDecideEligibility, ELIGIBILITY_DECISION_TARGET, eligibilityDisagrees, PASS_REASON_LABELS } from "@/lib/pipeline";
import { queueLessonSuggestions } from "@/lib/lesson-triggers";
import { DomainError, moveVentureStage } from "@/lib/ventures";
import type { EligibilityScreen, ExtractedFields } from "@/lib/deck-ai/schema";
import type { ActionResult } from "@/lib/action-result";

// ── Upload & analysis ───────────────────────────────────────────────────────

const StartSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine((n) => /\.pdf$/i.test(n), "Upload the deck as a PDF."),
  fileSize: z.number().int().positive().max(MAX_DECK_BYTES, "Decks must be 20 MB or smaller."),
  ventureId: z.string().optional(),
});

export type StartUploadResult = { error: string } | { analysisId: string; target: UploadTarget };

export async function startDeckUpload(input: z.input<typeof StartSchema>): Promise<StartUploadResult> {
  const user = await requireAdmin();
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid file" };
  const { fileName, fileSize, ventureId } = parsed.data;

  if (ventureId && !(await db.venture.findUnique({ where: { id: ventureId }, select: { id: true } }))) {
    return { error: "Venture not found." };
  }

  const id = randomUUID();
  const storagePath = deckPath(id, fileName);
  await db.deckAnalysis.create({
    data: { id, storagePath, fileName, fileSize, ventureId: ventureId ?? null, createdById: user.id },
  });
  try {
    return { analysisId: id, target: await createUploadTarget(storagePath, id) };
  } catch (e) {
    await markFailed(id, e instanceof Error ? e.message : "Couldn't prepare the upload.");
    return { error: e instanceof Error ? e.message : "Couldn't prepare the upload." };
  }
}

/** Called once the browser has finished uploading the PDF. */
export async function beginDeckAnalysis(analysisId: string): Promise<ActionResult> {
  await requireAdmin();
  const analysis = await db.deckAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis || analysis.status !== "PENDING") return { error: "This upload can't be analysed." };
  // Snapshot the Playbook version and approved lessons the AI will be given (kept with the screen).
  await db.deckAnalysis.update({ where: { id: analysisId }, data: { aiContext: await aiContextFor("ELIGIBILITY") } });
  await recordDeckDocument(analysisId); // a deck uploaded on an existing venture: list it under Documents
  await triggerWorker(analysisId);
  return { ok: true };
}

/** Re-run the screen on the stored copy of a venture's latest deck. */
export async function rerunDeckAnalysis(ventureId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const latest = await db.deckAnalysis.findFirst({
    where: { ventureId, status: { in: ["COMPLETE", "FAILED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { error: "No stored deck to re-run. Upload one instead." };

  const id = randomUUID();
  await db.deckAnalysis.create({
    data: {
      id,
      ventureId,
      storagePath: latest.storagePath,
      fileName: latest.fileName,
      fileSize: latest.fileSize,
      createdById: user.id,
      aiContext: await aiContextFor("ELIGIBILITY"), // the Playbook version and lessons this screen uses
    },
  });
  await triggerWorker(id);
  revalidatePath(`/deals/${ventureId}`);
  return { ok: true };
}

export type AnalysisStatus = {
  status: DeckStatus;
  error: string | null;
  extracted: ExtractedFields | null;
};

export async function getDeckAnalysisStatus(analysisId: string): Promise<AnalysisStatus | null> {
  await requireAdmin();
  const a = await db.deckAnalysis.findUnique({ where: { id: analysisId } });
  if (!a) return null;
  const effective = effectiveDeckStatus(a);
  return {
    status: effective.status,
    error: effective.error,
    extracted: effective.status === "COMPLETE" ? (a.extracted as ExtractedFields) : null,
  };
}

async function triggerWorker(analysisId: string) {
  const started = await triggerBackgroundJob({
    functionName: "analyze-deck-background",
    subject: analysisId,
    runInline: () => runDeckAnalysis(analysisId),
  });
  if (!started) await markFailed(analysisId, "The background worker couldn't be reached. Check the Netlify function deployed.");
}

async function markFailed(id: string, error: string) {
  await db.deckAnalysis.update({ where: { id }, data: { status: "FAILED", error, completedAt: new Date() } });
}

// ── Human decision on the screen ────────────────────────────────────────────

const DecisionSchema = z
  .object({
    decision: z.enum(EligibilityDecision, { message: "Choose a decision" }),
    passReason: z.enum(PassReason).optional(),
    note: z
      .string()
      .trim()
      .transform((s) => (s === "" ? null : s))
      .nullable()
      .optional(),
    analysisId: z
      .string()
      .transform((s) => (s === "" ? null : s))
      .nullable()
      .optional(),
  })
  .refine((d) => d.decision !== "NEED_MORE_INFO" || !!d.note, {
    message: "Say what to request from the founder.",
  })
  .refine((d) => d.decision !== "DECLINE" || !!d.passReason, { message: "Choose a reason for declining." });

const DECISION_LABELS: Record<EligibilityDecision, string> = {
  PROCEED: "proceed",
  DECLINE: "decline",
  NEED_MORE_INFO: "need more information",
};

export async function decideEligibility(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = DecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { decision, passReason, note, analysisId } = parsed.data;

  const venture = await db.venture.findUnique({ where: { id: ventureId }, select: { currentStage: true } });
  if (!venture) return { error: "Venture not found." };
  if (!canDecideEligibility(venture.currentStage)) {
    return { error: "This deal is past eligibility screening; move it from the Stage card instead." };
  }

  // Move first (it validates, e.g. "Other" needs a note); only record the review if it succeeded.
  const to = ELIGIBILITY_DECISION_TARGET[decision];
  if (to) {
    try {
      await moveVentureStage({
        ventureId,
        to,
        userId: user.id,
        passReason: decision === "DECLINE" ? passReason : null,
        note: `Eligibility review: ${DECISION_LABELS[decision]}${note ? `. ${note}` : ""}`,
      });
    } catch (e) {
      if (e instanceof DomainError) return { error: e.message };
      throw e;
    }
  }

  await db.eligibilityReview.create({
    data: {
      ventureId,
      analysisId: analysisId ?? null,
      decision,
      passReason: decision === "DECLINE" ? passReason : null,
      note,
      decidedById: user.id,
    },
  });

  // Learning moments (best effort): the team decided differently from the AI, or declined.
  const screen = analysisId ? ((await db.deckAnalysis.findUnique({ where: { id: analysisId }, select: { screen: true } }))?.screen as EligibilityScreen | null) : null;
  const decided = `${DECISION_LABELS[decision]}${decision === "DECLINE" && passReason ? ` (${PASS_REASON_LABELS[passReason]})` : ""}${note ? `. Note: ${note}` : ""}`;
  if (eligibilityDisagrees(screen?.recommendation, decision)) {
    await queueLessonSuggestions({
      ventureId,
      trigger: "ELIGIBILITY_DECIDED",
      moment: `At the eligibility screen the AI recommended "${screen!.recommendation}", but the DXV team decided: ${decided}.`,
      userId: user.id,
    });
  } else if (decision === "DECLINE") {
    await queueLessonSuggestions({ ventureId, trigger: "DECLINED", moment: `Declined at the eligibility screen: ${decided}.`, userId: user.id });
  }

  revalidatePath(`/deals/${ventureId}`);
  revalidatePath("/deals");
  revalidatePath("/activity");
  revalidatePath("/");
  return { ok: true };
}

// ── Board intake: drop founder decks on the Submitted column ────────────────
// Flow: startDeckIntake → (browser uploads the PDF) → finishDeckIntake, which
// creates the deal card and asks the worker for a quick read of name, founder and
// stage. No eligibility screen: that runs later from the deal page.

const IntakeSchema = StartSchema.omit({ ventureId: true }).extend({
  round: z.number().int().positive().nullable().optional(),
});

export async function startDeckIntake(input: z.input<typeof IntakeSchema>): Promise<StartUploadResult> {
  const user = await requireAdmin();
  const parsed = IntakeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid file" };
  const { fileName, fileSize } = parsed.data;

  const id = randomUUID();
  const storagePath = deckPath(id, fileName);
  await db.deckAnalysis.create({ data: { id, storagePath, fileName, fileSize, intakeOnly: true, createdById: user.id } });
  try {
    return { analysisId: id, target: await createUploadTarget(storagePath, id) };
  } catch (e) {
    await markFailed(id, e instanceof Error ? e.message : "Couldn't prepare the upload.");
    return { error: e instanceof Error ? e.message : "Couldn't prepare the upload." };
  }
}

/** Called once the browser has uploaded the PDF: create the Submitted card, store the deck, start the read. */
export async function finishDeckIntake(analysisId: string, round?: number | null): Promise<ActionResult> {
  const user = await requireAdmin();
  const analysis = await db.deckAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis || !analysis.intakeOnly || analysis.status !== "PENDING" || analysis.ventureId) {
    return { error: "This upload can't be filed." };
  }
  // The file name stands in as the company name until the read fills it in.
  const venture = await db.venture.create({
    data: {
      name: analysis.fileName,
      round: round && Number.isInteger(round) && round > 0 ? round : null,
      createdById: user.id,
      stageChanges: { create: { fromStage: null, toStage: "SUBMITTED", changedById: user.id, note: "Deck uploaded from the board" } },
    },
  });
  await db.deckAnalysis.update({ where: { id: analysisId }, data: { ventureId: venture.id } });
  await recordDeckDocument(analysisId); // the deck is listed under the deal's Documents
  await triggerWorker(analysisId);
  revalidatePath("/deals");
  revalidatePath("/");
  return { ok: true };
}
