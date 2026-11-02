"use server";

// Members' opportunities pack: draft with AI (one job for every deal at Member Pitch
// Selection in a round), edit, approve for members, logos. Team only. Nothing reaches
// members until a partner approves; approved versions are locked.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueNumbers, renderMemo, reviewIssueName } from "@/lib/memo-ai/render";
import type { MemoContent } from "@/lib/memo-ai/schema";
import { aiContextFor } from "@/lib/playbook/current";
import { formatGbp, impactThemeOptions } from "@/lib/pipeline";
import { applyOpportunityEdits, approvalProblems, packTitle } from "@/lib/opportunities/build";
import type { OpportunityContext, OpportunityDealContext } from "@/lib/opportunities/context";
import type { OpportunityContent } from "@/lib/opportunities/schema";
import { MAX_LOGO_BYTES, sniffLogoType } from "@/lib/opportunities/logo";
import { OPPORTUNITY_JOB_PREFIX, runOpportunityPack } from "@/lib/opportunity-worker";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import type { ActionResult } from "@/lib/action-result";

const PAGE = "/deals/opportunities";

export async function generateOpportunityPack(round: number): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!Number.isInteger(round) || round < 1) return { error: "Choose a round." };
  const [ventures, running, ai] = await Promise.all([
    db.venture.findMany({
      where: { round, currentStage: "PITCH_SELECTION" },
      orderBy: { name: "asc" },
      include: {
        deckAnalyses: { where: { status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 1, select: { storagePath: true, fileName: true } },
        memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" }, select: { id: true, version: true, content: true } },
      },
    }),
    db.opportunityPack.findFirst({ where: { round, status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } }),
    aiContextFor("ASSESSMENT"),
  ]);
  if (running) return { error: "A pack for this round is already being drafted." };
  if (!ventures.length) return { error: `No deals in Round ${round} are at Member Pitch Selection.` };

  const deals: OpportunityDealContext[] = ventures.map((v) => {
    const issue = v.memoVersions.find((m) => m.content);
    return {
      ventureId: v.id,
      name: v.name,
      sector: v.sector,
      stage: v.companyStage,
      raise: v.raiseAmountGbp ? formatGbp(v.raiseAmountGbp) : null,
      oneLiner: v.oneLiner,
      founderDiversity: v.founderDiversity,
      membersSummary: v.angelSummary,
      // Members' material starts only from the issued memo (never AI or working drafts).
      memo: issue
        ? { name: reviewIssueName(issueNumbers(v.memoVersions).get(issue.id)!), text: renderMemo(issue.content as MemoContent, { banner: false }) }
        : null,
      deck: v.deckAnalyses[0] ? { storagePath: v.deckAnalyses[0].storagePath, fileName: v.deckAnalyses[0].fileName } : null,
    };
  });
  const context: OpportunityContext = { round, themes: impactThemeOptions(ai.playbook.impactThemes), deals, ai };
  const pack = await db.$transaction(async (tx) => {
    const last = await tx.opportunityPack.findFirst({ where: { round }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.opportunityPack.create({ data: { round, number: (last?.number ?? 0) + 1, title: packTitle(new Date()), context, createdById: user.id } });
  });
  const started = await triggerBackgroundJob({
    functionName: "opportunity-pack-background",
    subject: `${OPPORTUNITY_JOB_PREFIX}${pack.id}`,
    runInline: () => runOpportunityPack(pack.id),
  });
  if (!started) {
    await db.opportunityPack.update({
      where: { id: pack.id },
      data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() },
    });
  }
  revalidatePath(PAGE);
  return { ok: true };
}

/** A new editable version copied from this one (to change an approved pack). */
export async function reviseOpportunityPack(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const p = await db.opportunityPack.findUnique({ where: { id } });
  if (!p || p.status !== "COMPLETE" || !p.content) return { error: "That pack can't be copied." };
  await db.$transaction(async (tx) => {
    const last = await tx.opportunityPack.findFirst({ where: { round: p.round }, orderBy: { number: "desc" }, select: { number: true } });
    await tx.opportunityPack.create({
      data: {
        round: p.round,
        number: (last?.number ?? 0) + 1,
        title: p.title,
        status: "COMPLETE",
        context: p.context ?? {},
        aiOutput: p.aiOutput ?? undefined,
        content: p.content ?? undefined,
        model: p.model,
        createdById: user.id,
        completedAt: new Date(),
      },
    });
  });
  revalidatePath(PAGE);
  return { ok: true };
}

/** Save the partners' edits (never on an approved pack). The form's `version` guards against overwriting a newer save. */
export async function saveOpportunityPack(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const p = await db.opportunityPack.findUnique({
    where: { id },
    select: { status: true, content: true, editedAt: true, approvedAt: true, updatedBy: { select: { name: true } } },
  });
  if (!p || p.status !== "COMPLETE" || !p.content) return { error: "This pack can't be edited. Reload the page." };
  if (p.approvedAt) return { error: "This pack is approved for members, so it's locked. Make a new version to change it." };
  if ((p.editedAt?.toISOString() ?? "") !== String(formData.get("version") ?? "")) {
    return { error: `${p.updatedBy?.name ?? "Another partner"} saved changes since you opened this. Copy anything you've written, then reload the page.` };
  }
  const get = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : null;
  };
  const content = applyOpportunityEdits(p.content as OpportunityContent, get);
  if (JSON.stringify(content).length > 200_000) return { error: "That's too long to save. Shorten some slides." };
  const { count } = await db.opportunityPack.updateMany({
    where: { id, editedAt: p.editedAt, approvedAt: null },
    data: { content, updatedById: user.id, editedAt: new Date() },
  });
  if (!count) return { error: "Another partner saved at the same moment. Reload the page." };
  revalidatePath(PAGE);
  return { ok: true };
}

/** Approve for members: every company shared with members and every slide filled. Locks this version. */
export async function approveOpportunityPack(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const p = await db.opportunityPack.findUnique({ where: { id }, select: { status: true, content: true, approvedAt: true } });
  if (!p || p.status !== "COMPLETE" || !p.content) return { error: "This pack isn't ready." };
  if (p.approvedAt) return { ok: true };
  const content = p.content as OpportunityContent;
  const shared = await db.venture.findMany({
    where: { id: { in: content.deals.map((d) => d.ventureId) }, sharedWithAngelsAt: { not: null }, currentStage: { not: "PASSED" } },
    select: { id: true },
  });
  const problems = approvalProblems(content, new Set(shared.map((v) => v.id)));
  if (problems.length) return { error: problems.join(" ") };
  await db.opportunityPack.updateMany({ where: { id, approvedAt: null }, data: { approvedAt: new Date(), approvedById: user.id } });
  revalidatePath(PAGE);
  revalidatePath("/portal/deals");
  return { ok: true };
}

/** Upload a company's logo (PNG or JPEG, up to 500 KB). Adds a row; the latest is used. */
export async function uploadVentureLogo(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PNG or JPEG image." };
  if (file.size > MAX_LOGO_BYTES) return { error: "Logos must be 500 KB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffLogoType(bytes);
  if (!mimeType) return { error: "Logos must be PNG or JPEG images." };
  if (!(await db.venture.findUnique({ where: { id: ventureId }, select: { id: true } }))) return { error: "Deal not found." };
  await db.ventureLogo.create({ data: { ventureId, mimeType, data: Buffer.from(bytes), createdById: user.id } });
  revalidatePath(PAGE);
  return { ok: true };
}
