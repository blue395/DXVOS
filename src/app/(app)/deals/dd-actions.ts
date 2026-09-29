"use server";

// Server action for the DXV Due Diligence document (AI first draft, Word file).
// The AI suggests what to check; the DD group does the checking. Nothing here moves a deal.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderScreen } from "@/lib/deck-ai/render";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { DECK_BUCKET } from "@/lib/deck-storage";
import type { DDContext } from "@/lib/dd-doc/context";
import { DD_JOB_PREFIX, runDDReport } from "@/lib/dd-worker";
import { aiDraftName, issueNumbers, renderMemo, reviewDraftName, reviewIssueName } from "@/lib/memo-ai/render";
import type { MemoContent } from "@/lib/memo-ai/schema";
import { canCreateDDDocument, formatGbp, stageLabel } from "@/lib/pipeline";
import { formatDate } from "@/components/ui";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import type { ActionResult } from "@/lib/action-result";

export async function generateDDDocument(ventureId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const v = await db.venture.findUnique({
    where: { id: ventureId },
    include: {
      deckAnalyses: { orderBy: { createdAt: "desc" } },
      memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" } },
      memoDrafts: { where: { archivedAt: null }, take: 1 },
      memoAnalyses: { where: { status: "COMPLETE" }, orderBy: { number: "desc" }, take: 1 },
      ddItems: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!v) return { error: "Venture not found." };
  if (!canCreateDDDocument(v.currentStage)) return { error: "The DD document is available from DXV Partner Review onwards." };
  if (await db.dDReportJob.findFirst({ where: { ventureId, status: { in: ["PENDING", "PROCESSING"] } } })) {
    return { error: "A DD document is already being drafted." };
  }

  // The best memo on record: the latest reviewed issue, else the open review draft, else the latest AI draft.
  const issue = v.memoVersions[0];
  const memo = issue?.content
    ? { name: reviewIssueName(issueNumbers(v.memoVersions).get(issue.id)!), content: issue.content as MemoContent }
    : v.memoDrafts[0]
      ? { name: `${reviewDraftName(v.memoDrafts[0].number)} (not yet issued)`, content: v.memoDrafts[0].content as MemoContent }
      : v.memoAnalyses[0]?.output
        ? { name: `${aiDraftName(v.memoAnalyses[0].number)} (not reviewed)`, content: v.memoAnalyses[0].output as MemoContent }
        : null;

  const deck = v.deckAnalyses.find((a) => a.status !== "PENDING");
  const screen = v.deckAnalyses.find((a) => a.status === "COMPLETE" && a.screen)?.screen as EligibilityScreen | undefined;

  const context: DDContext = {
    ventureName: v.name,
    details: [
      { label: "Founders", value: v.founderNames ?? "" },
      { label: "Sector", value: v.sector ?? "" },
      { label: "Company stage", value: v.companyStage ?? "" },
      { label: "Raising", value: v.raiseAmountGbp ? formatGbp(v.raiseAmountGbp) : "" },
      { label: "DXV round", value: v.round ? `Round ${v.round}` : "Not assigned" },
      { label: "Pipeline stage", value: stageLabel(v.currentStage) },
      { label: "Website", value: v.website ?? "" },
    ],
    memo: memo ? { name: memo.name, text: renderMemo(memo.content, { banner: false }) } : null,
    eligibilityScreen: screen ? renderScreen(screen) : null,
    ddItems: v.ddItems.map(
      (i) => `${i.title}${i.owner ? ` (owner: ${i.owner})` : ""}${i.completedAt ? ", done" : i.dueDate ? `, due ${formatDate(i.dueDate)}` : ""}`,
    ),
    deck: deck ? { bucket: DECK_BUCKET, storagePath: deck.storagePath, fileName: deck.fileName } : null,
    preparedBy: user.name,
  };

  const job = await db.dDReportJob.create({ data: { ventureId, context, createdById: user.id } });
  const started = await triggerBackgroundJob({
    functionName: "generate-dd-background",
    subject: `${DD_JOB_PREFIX}${job.id}`,
    runInline: () => runDDReport(job.id),
  });
  if (!started) {
    await db.dDReportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() },
    });
  }
  revalidatePath(`/deals/${ventureId}`);
  return { ok: true };
}
