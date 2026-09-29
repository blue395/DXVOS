import "server-only";
// Queues an AI lesson suggestion after a moment worth learning from. Best effort:
// a failure here is logged and never blocks the action that triggered it.
import type { LessonTrigger } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { renderScreen } from "@/lib/deck-ai/render";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { LESSON_JOB_PREFIX, runLessonJob } from "@/lib/lesson-worker";
import type { LessonJobContext } from "@/lib/lessons-ai/context";
import { maxScore, totalScore, type MemoContent } from "@/lib/memo-ai/schema";
import { formatGbp, stageLabel } from "@/lib/pipeline";
import { triggerBackgroundJob } from "@/lib/trigger-worker";

async function dealFacts(ventureId: string) {
  const v = await db.venture.findUnique({
    where: { id: ventureId },
    include: {
      deckAnalyses: { where: { status: "COMPLETE" }, orderBy: { completedAt: "desc" }, take: 1, select: { screen: true } },
      memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" }, take: 1, select: { content: true } },
      memoAnalyses: { where: { status: "COMPLETE" }, orderBy: { number: "desc" }, take: 1, select: { output: true } },
      stageChanges: { orderBy: { changedAt: "asc" }, select: { fromStage: true, toStage: true, note: true } },
    },
  });
  if (!v) return null;
  const facts = [
    `Sector: ${v.sector ?? "not recorded"}. Company stage: ${v.companyStage ?? "not recorded"}. Raising: ${v.raiseAmountGbp ? formatGbp(v.raiseAmountGbp) : "not recorded"}.`,
    v.description ? `Description: ${v.description}` : null,
  ].filter((x): x is string => !!x);
  const screen = v.deckAnalyses[0]?.screen as EligibilityScreen | undefined;
  if (screen) facts.push("", "AI eligibility screen:", renderScreen(screen));
  const memo = (v.memoVersions[0]?.content ?? v.memoAnalyses[0]?.output) as MemoContent | undefined;
  if (memo) {
    facts.push(
      "",
      `${v.memoVersions[0] ? "Issued memo" : "AI memo draft"}: ${totalScore(memo.scores)}/${maxScore(memo.scores)}.`,
      `Conclusion: ${memo.conclusion}`,
      `Scores: ${memo.scores.map((s) => `${s.criterion} ${s.score}/5`).join("; ")}`,
    );
  }
  facts.push("", `Stage history: ${v.stageChanges.map((c) => stageLabel(c.toStage) + (c.note ? ` (${c.note})` : "")).join(" to ")}`);
  return { name: v.name, facts };
}

export async function queueLessonSuggestions(opts: { ventureId: string; trigger: LessonTrigger; moment: string; userId: string }): Promise<void> {
  try {
    const [deal, existing] = await Promise.all([
      dealFacts(opts.ventureId),
      db.lesson.findMany({ where: { status: { in: ["APPROVED", "SUGGESTED"] } }, orderBy: { createdAt: "desc" }, take: 60, select: { title: true } }),
    ]);
    if (!deal) return;
    const context: LessonJobContext = { ventureName: deal.name, moment: opts.moment, facts: deal.facts, existingLessons: existing.map((l) => l.title) };
    const job = await db.lessonJob.create({ data: { ventureId: opts.ventureId, trigger: opts.trigger, context, createdById: opts.userId } });
    const started = await triggerBackgroundJob({
      functionName: "suggest-lessons-background",
      subject: `${LESSON_JOB_PREFIX}${job.id}`,
      runInline: () => runLessonJob(job.id),
    });
    if (!started) {
      await db.lessonJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() } });
    }
  } catch (e) {
    console.error("Couldn't queue lesson suggestions:", e);
  }
}
