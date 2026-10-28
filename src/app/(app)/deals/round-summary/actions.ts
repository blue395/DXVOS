"use server";

// Partner Review round summary: generate (one background job for every deal at DXV
// Partner Review in a round) and save the partners' edits. Team only. The AI suggests;
// partners decide who pitches. Nothing here moves a deal.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { themesFrom } from "@/components/theme-pills";
import { renderScreen } from "@/lib/deck-ai/render";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { aiDraftName, issueNumbers, renderMemo, reviewDraftName, reviewIssueName } from "@/lib/memo-ai/render";
import { maxScore, totalScore, type MemoContent } from "@/lib/memo-ai/schema";
import { aiContextFor } from "@/lib/playbook/current";
import { ELIGIBILITY_DECISION_LABELS, formatGbp, PASS_REASON_LABELS } from "@/lib/pipeline";
import { applySummaryEdits } from "@/lib/round-summary/build";
import type { RoundSummaryContext, SummaryDealContext } from "@/lib/round-summary/context";
import type { RoundSummaryContent } from "@/lib/round-summary/schema";
import { ROUND_SUMMARY_JOB_PREFIX, runRoundSummary } from "@/lib/round-summary-worker";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import { FOUNDER_SUBMISSIONS_INCLUDE, founderInfoFrom, renderFounderInfo } from "@/lib/founder-info";
import type { ActionResult } from "@/lib/action-result";

const PAGE = "/deals/round-summary";

export async function generateRoundSummary(round: number): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!Number.isInteger(round) || round < 1) return { error: "Choose a round." };
  const [ventures, running, ai] = await Promise.all([
    db.venture.findMany({
      where: { round, currentStage: "PARTNER_REVIEW" },
      orderBy: { name: "asc" },
      include: {
        deckAnalyses: { orderBy: { createdAt: "desc" } },
        eligibilityReviews: { orderBy: { decidedAt: "asc" }, include: { decidedBy: { select: { name: true } } } },
        memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" }, select: { id: true, version: true, content: true } },
        memoDrafts: { where: { archivedAt: null }, take: 1, select: { number: true, content: true } },
        memoAnalyses: { where: { status: "COMPLETE" }, orderBy: { number: "desc" }, take: 1, select: { number: true, output: true } },
        founderSubmissions: FOUNDER_SUBMISSIONS_INCLUDE,
      },
    }),
    db.roundSummary.findFirst({ where: { round, status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } }),
    aiContextFor("ASSESSMENT"),
  ]);
  if (running) return { error: "A summary for this round is already being written." };
  if (!ventures.length) return { error: `No deals in Round ${round} are at DXV Partner Review.` };

  const deals: SummaryDealContext[] = ventures.map((v) => {
    const deck = v.deckAnalyses.find((a) => a.status !== "PENDING");
    const screen = v.deckAnalyses.find((a) => a.status === "COMPLETE" && a.screen)?.screen as EligibilityScreen | undefined;
    const lastDecision = v.eligibilityReviews.at(-1);
    // The memo so far: the latest issue, else the working review draft, else the latest AI draft.
    const issue = v.memoVersions.find((m) => m.content);
    const memo: { name: string; content: MemoContent } | null = issue
      ? { name: reviewIssueName(issueNumbers(v.memoVersions).get(issue.id)!), content: issue.content as MemoContent }
      : v.memoDrafts[0]
        ? { name: reviewDraftName(v.memoDrafts[0].number), content: v.memoDrafts[0].content as MemoContent }
        : v.memoAnalyses[0]?.output
          ? { name: aiDraftName(v.memoAnalyses[0].number), content: v.memoAnalyses[0].output as MemoContent }
          : null;
    return {
      ventureId: v.id,
      name: v.name,
      facts: {
        oneLiner: v.oneLiner,
        sector: v.sector,
        stage: v.companyStage,
        raise: v.raiseAmountGbp ? formatGbp(v.raiseAmountGbp) : null,
        eligibility: lastDecision ? `${ELIGIBILITY_DECISION_LABELS[lastDecision.decision]} (${lastDecision.decidedBy.name})` : null,
        memoScore: memo ? `${totalScore(memo.content.scores)}/${maxScore(memo.content.scores)} (${memo.name})` : null,
      },
      details: { Founders: v.founderNames, Website: v.website, Description: v.description },
      eligibilityScreen: screen ? renderScreen(screen) : null,
      eligibilityDecisions: v.eligibilityReviews.map(
        (r) =>
          `${ELIGIBILITY_DECISION_LABELS[r.decision]} (${r.decidedBy.name})` +
          (r.passReason ? `, reason: ${PASS_REASON_LABELS[r.passReason]}` : "") +
          (r.note ? `: ${r.note}` : ""),
      ),
      memo: memo ? { name: memo.name, text: renderMemo(memo.content, { banner: false }) } : null,
      founderInfo: renderFounderInfo(founderInfoFrom(v)),
      deck: deck ? { storagePath: deck.storagePath, fileName: deck.fileName } : null,
    };
  });
  const context: RoundSummaryContext = { round, deals, ai };

  const summary = await db.$transaction(async (tx) => {
    const last = await tx.roundSummary.findFirst({ where: { round }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.roundSummary.create({ data: { round, number: (last?.number ?? 0) + 1, context, createdById: user.id } });
  });
  const started = await triggerBackgroundJob({
    functionName: "round-summary-background",
    subject: `${ROUND_SUMMARY_JOB_PREFIX}${summary.id}`,
    runInline: () => runRoundSummary(summary.id),
  });
  if (!started) {
    await db.roundSummary.update({
      where: { id: summary.id },
      data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() },
    });
  }
  revalidatePath(PAGE);
  return { ok: true };
}

/** Save the partners' edits. The form's `version` is the copy they opened (another partner's save in between is never overwritten). */
export async function saveRoundSummary(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const version = String(formData.get("version") ?? "");
  const s = await db.roundSummary.findUnique({ where: { id }, select: { status: true, content: true, editedAt: true, updatedBy: { select: { name: true } } } });
  if (!s || s.status !== "COMPLETE" || !s.content) return { error: "This summary can't be edited. Reload the page." };
  if ((s.editedAt?.toISOString() ?? "") !== version) {
    return { error: `${s.updatedBy?.name ?? "Another partner"} saved changes since you opened this. Copy anything you've written, then reload the page.` };
  }
  const get = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : null;
  };
  const content = applySummaryEdits(s.content as RoundSummaryContent, get, (name) => themesFrom(formData, name));
  // Bounded, like other free-text fields.
  if (JSON.stringify(content).length > 200_000) return { error: "That's too long to save. Shorten some sections." };
  const { count } = await db.roundSummary.updateMany({
    where: { id, editedAt: s.editedAt },
    data: { content, updatedById: user.id, editedAt: new Date() },
  });
  if (!count) return { error: "Another partner saved at the same moment. Reload the page." };
  revalidatePath(PAGE);
  return { ok: true };
}
