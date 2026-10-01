"use server";

// Emails to angels: templates (the welcome email, bulk-email starting points), test sends,
// and bulk emails sent in small batches. Team only.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { complianceReady } from "@/lib/compliance";
import { db } from "@/lib/db";
import { appOrigin, mailConfigured, sendMail } from "@/lib/mail";
import { firstNameOf, renderMemberEmail, templateProblems } from "@/lib/member-email";
import { sendNextBatch } from "@/lib/member-emails";
import { isMemberEmailAudience } from "@/lib/pipeline";
import { loadAudiences } from "./audience";

const TemplateSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name").max(120),
  subject: z.string().trim().min(1, "Add a subject").max(200),
  body: z
    .string()
    .transform((b) => b.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().min(1, "Add the message").max(20_000)),
});

/** Create (id null) or update a template. */
export async function saveTemplate(id: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = TemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (id) {
    const t = await db.emailTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!t) return { error: "Template not found." };
    await db.emailTemplate.update({ where: { id }, data: { ...parsed.data, updatedById: me.id } });
  } else {
    const t = await db.emailTemplate.create({ data: { ...parsed.data, createdById: me.id, updatedById: me.id } });
    revalidatePath("/angels/emails");
    redirect(`/angels/emails/templates/${t.id}`);
  }
  revalidatePath("/angels/emails");
  return { ok: true };
}

/** Archive a template (the welcome email can't be: invites need it). */
export async function archiveTemplate(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const t = await db.emailTemplate.findUnique({ where: { id }, select: { key: true } });
  if (!t) return { error: "Template not found." };
  if (t.key === "welcome") return { error: "The welcome email is used for invites, so it stays. Edit it instead." };
  await db.emailTemplate.update({ where: { id }, data: { archivedAt: new Date(), updatedById: me.id } });
  revalidatePath("/angels/emails");
  redirect("/angels/emails");
}

const DraftSchema = z.object({ subject: z.string().max(200), body: z.string().max(20_000) });

/** Send the draft to me, as a member would see it (the link goes to the sign-in page; no invite is made). */
export async function sendTestEmail(draft: { subject: string; body: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const d = DraftSchema.parse(draft);
  const problems = templateProblems(d);
  if (problems.length) return { error: problems.join(" ") };
  const origin = appOrigin();
  if (!mailConfigured() || !origin) return { error: "Email isn't set up." };
  const mail = renderMemberEmail(d, { first_name: firstNameOf(me.name), platform_link: `${origin}/login` }, { unsubscribeUrl: `${origin}/unsubscribe/test` });
  try {
    await sendMail({ to: me.email, ...mail, subject: `[Test] ${mail.subject}` });
  } catch (e) {
    console.error("Test email failed", e);
    return { error: "The test email didn't send. Check the email settings." };
  }
  return { ok: true };
}

const CreateSchema = DraftSchema.extend({ audience: z.string(), angelIds: z.array(z.string()).min(1, "Choose at least one person.").max(2000) });

/**
 * Record a bulk email and who it goes to (only people really in the chosen audience).
 * Sending then happens in batches from its page.
 */
export async function createMemberEmail(input: { subject: string; body: string; audience: string; angelIds: string[] }): Promise<{ error: string } | { id: string }> {
  const me = await requireAdmin();
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the email." };
  const { subject, body, audience, angelIds } = parsed.data;
  if (!isMemberEmailAudience(audience)) return { error: "Choose who it's for." };
  const problems = templateProblems({ subject, body });
  if (problems.length) return { error: problems.join(" ") };
  if (!mailConfigured() || !appOrigin()) return { error: "Email isn't set up." };
  const group = (await loadAudiences()).find((a) => a.key === audience)!;
  const chosen = new Set(angelIds);
  const people = group.people.filter((p) => chosen.has(p.id));
  if (people.length === 0) return { error: "None of the chosen people are in that group any more. Reload the page." };
  if (people.some((p) => !p.hasLogin) && !(await complianceReady()).ready) {
    return { error: "Some of them aren't on the platform yet, and invites are paused until the investor statements and member terms are approved." };
  }
  const email = await db.memberEmail.create({
    data: {
      subject,
      body,
      audience,
      createdById: me.id,
      recipients: { create: people.map((p) => ({ angelId: p.id, email: p.email })) },
    },
  });
  revalidatePath("/angels/emails");
  return { id: email.id };
}

/** Send the next batch of a bulk email; the page calls this until nothing's left. */
export async function sendMemberEmailBatch(id: string): Promise<{ error: string } | { sent: number; failed: number; pending: number; sending: number }> {
  const me = await requireAdmin();
  try {
    const r = await sendNextBatch(id, me.id);
    if (r.pending === 0) revalidatePath(`/angels/emails/${id}`);
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sending stopped." };
  }
}

/** Put failed (or interrupted) copies back in the queue. */
export async function retryMemberEmail(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.memberEmailRecipient.updateMany({ where: { memberEmailId: id, status: { in: ["FAILED", "SENDING"] } }, data: { status: "PENDING", error: null } });
  revalidatePath(`/angels/emails/${id}`);
  return { ok: true };
}
