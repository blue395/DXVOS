"use server";

// Partners' emails to several founders at once: test send, create (who it goes to is
// re-checked here), send in batches, retry. Team only.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ATTACHMENTS, MAX_ATTACHMENTS_BYTES } from "@/lib/email-attachments";
import { sendFounderDigest } from "@/lib/founder-submissions";
import { founderRecipients, sendNextFounderBatch, type BatchCounts } from "@/lib/founder-bulk-emails";
import { firstNameOf, founderEmailProblems, renderMemberEmail } from "@/lib/member-email";
import { loadEmailAttachments } from "@/lib/member-emails";
import { mailConfigured, sendMail } from "@/lib/mail";
import { ALL_STAGES, founderAudienceLabel } from "@/lib/pipeline";
import type { Stage } from "@/generated/prisma/enums";

const DraftSchema = z.object({
  subject: z.string().max(200),
  body: z.string().max(20_000),
  attachmentIds: z.array(z.string()).max(MAX_ATTACHMENTS).default([]),
});

const FilterSchema = z.object({
  round: z.number().int().positive().nullable(),
  stages: z.array(z.string().refine((s) => ALL_STAGES.some((x) => x.key === s && s !== "PASSED"))).max(20),
  includeDeclined: z.boolean(),
});

/** Send the draft to me, filled in for one of the chosen companies. */
export async function sendFounderTestEmail(draft: { subject: string; body: string; attachmentIds?: string[]; sampleCompany?: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const d = DraftSchema.parse(draft);
  const problems = founderEmailProblems(d);
  if (problems.length) return { error: problems.join(" ") };
  if (!mailConfigured()) return { error: "Email isn't set up." };
  const mail = renderMemberEmail(d, { first_name: firstNameOf(me.name), company: String(draft.sampleCompany ?? "Example Ltd").slice(0, 120) });
  try {
    const { files } = await loadEmailAttachments({ ids: d.attachmentIds, createdById: me.id });
    await sendMail({ to: me.email, ...mail, subject: `[Test] ${mail.subject}`, attachments: files });
  } catch (e) {
    console.error("Founder test email failed", e instanceof Error ? e.name : "error");
    return { error: "The test email didn't send. Check the email settings." };
  }
  return { ok: true };
}

/** Record the email and which deals it goes to; sending then happens in batches from its page. */
export async function createFounderBulkEmail(input: {
  subject: string;
  body: string;
  filter: { round: number | null; stages: string[]; includeDeclined: boolean };
  ventureIds: string[];
  attachmentIds?: string[];
}): Promise<{ error: string } | { id: string }> {
  const me = await requireAdmin();
  const d = DraftSchema.safeParse(input);
  const f = FilterSchema.safeParse(input.filter);
  const ids = z.array(z.string()).min(1, "Choose at least one deal.").max(1000).safeParse(input.ventureIds);
  if (!d.success || !f.success) return { error: "Check the email and who it's for." };
  if (!ids.success) return { error: ids.error.issues[0]?.message ?? "Choose at least one deal." };
  const problems = founderEmailProblems(d.data);
  if (problems.length) return { error: problems.join(" ") };
  if (!mailConfigured()) return { error: "Email isn't set up." };
  const filter = { ...f.data, stages: f.data.stages as Stage[] };
  const people = await founderRecipients(filter, ids.data);
  if (people.length === 0) return { error: "None of the chosen deals match any more. Reload the page." };
  // Attachments: only my own uploaded drafts, and never an opportunities pack (that's for members).
  const { attachmentIds } = d.data;
  const attachments = attachmentIds.length
    ? await db.memberEmailAttachment.findMany({
        where: { id: { in: attachmentIds }, createdById: me.id, memberEmailId: null, founderBulkEmailId: null, uploadedAt: { not: null } },
      })
    : [];
  if (attachments.length !== attachmentIds.length) return { error: "An attachment is missing. Remove it and attach it again." };
  if (attachments.some((a) => a.opportunityPackId)) return { error: "The opportunities pack is for members, so it can't go to founders. Remove it first." };
  if (attachments.reduce((n, a) => n + a.sizeBytes, 0) > MAX_ATTACHMENTS_BYTES) return { error: "Attachments can be 15 MB in total." };
  const email = await db.founderBulkEmail.create({
    data: {
      subject: d.data.subject,
      body: d.data.body.replace(/\r\n/g, "\n"),
      audience: founderAudienceLabel(filter),
      createdById: me.id,
      recipients: { create: people.map((v) => ({ ventureId: v.id, email: v.email })) },
    },
  });
  if (attachments.length) {
    await db.memberEmailAttachment.updateMany({ where: { id: { in: attachments.map((a) => a.id) } }, data: { founderBulkEmailId: email.id } });
  }
  revalidatePath("/deals/founder-emails");
  return { id: email.id };
}

/** Send the next batch; the page calls this until nothing's left. */
export async function sendFounderBulkBatch(id: string): Promise<{ error: string } | BatchCounts> {
  const me = await requireAdmin();
  try {
    const r = await sendNextFounderBatch(id, me.id);
    if (r.pending === 0) revalidatePath(`/deals/founder-emails/${id}`);
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sending stopped." };
  }
}

/** Put failed (or interrupted) copies back in the queue. */
export async function retryFounderBulkEmail(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.founderBulkRecipient.updateMany({ where: { bulkEmailId: id, status: { in: ["FAILED", "SENDING"] } }, data: { status: "PENDING", error: null } });
  revalidatePath(`/deals/founder-emails/${id}`);
  return { ok: true };
}

/** Send the partners' founder-submissions digest now (normally it goes each morning). */
export async function sendDigestNow(): Promise<ActionResult> {
  await requireAdmin();
  if (!mailConfigured()) return { error: "Email isn't set up." };
  const r = await sendFounderDigest();
  revalidatePath("/deals/founder-emails");
  return r.submissions === 0 ? { error: "No new submissions since the last digest, so nothing was sent." } : { ok: true };
}
