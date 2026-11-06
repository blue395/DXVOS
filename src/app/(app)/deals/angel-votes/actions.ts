"use server";

// "Open angel votes" (Blue, 2026-11-06): after the round's opportunities are presented live, a
// partner opens members' pitch-selection voting for the round open to members, and (usually)
// emails every member who can see deals. Opening is a new MemberRound row (append-only), so it
// records who opened it and when; only votes from that moment count.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { appOrigin, mailConfigured } from "@/lib/mail";
import { templateProblems } from "@/lib/member-email";
import { openVotingProblem } from "@/lib/pipeline";
import { loadVoteRounds } from "@/lib/portal-deals";
import { loadAudiences } from "../../angels/emails/audience";

const OpenSchema = z.object({
  sendEmail: z.literal("on").optional(),
  subject: z.string().trim().max(200).default(""),
  body: z
    .string()
    .default("")
    .transform((b) => b.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(20_000)),
});

export async function openAngelVoting(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = OpenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { sendEmail, subject, body } = parsed.data;
  const rounds = await loadVoteRounds();
  const problem = openVotingProblem(rounds);
  if (problem) return { error: problem };
  const current = rounds.current!;

  let people: { id: string; email: string }[] = [];
  if (sendEmail) {
    if (!subject || !body) return { error: "Add the email's subject and message, or untick “Email members now”." };
    const problems = templateProblems({ subject, body });
    if (problems.length) return { error: problems.join(" ") };
    if (!mailConfigured() || !appOrigin()) return { error: "Email isn't set up. Untick “Email members now” to open voting without it." };
    // Re-checked here, never taken from the page: members on the platform with a current investor statement.
    people = (await loadAudiences()).find((a) => a.key === "deal-access")!.people;
    if (people.length === 0) return { error: "No members can see deals yet, so there's nobody to email. Untick “Email members now” to open voting anyway." };
  }

  const opened = await db.$transaction(async (tx) => {
    // Opened once: a second click (or tab) finds it already open and does nothing.
    const latest = await tx.memberRound.findFirst({ orderBy: { createdAt: "desc" }, select: { round: true, votingOpenedAt: true } });
    if (latest?.round !== current.round || latest.votingOpenedAt) return null;
    await tx.memberRound.create({ data: { round: current.round, votingClosesAt: current.votingClosesAt, votingOpenedAt: new Date(), byId: me.id } });
    if (!sendEmail) return { emailId: null };
    const email = await tx.memberEmail.create({
      data: { subject, body, audience: "deal-access", createdById: me.id, recipients: { create: people.map((p) => ({ angelId: p.id, email: p.email })) } },
    });
    return { emailId: email.id };
  });
  if (!opened) return { error: `Voting for Round ${current.round} is already open. Reload the page.` };

  revalidatePath("/deals/angel-votes");
  revalidatePath("/");
  revalidatePath("/portal", "layout");
  // Sending happens in batches of 5 from the email's page, like every bulk email.
  if (opened.emailId) redirect(`/angels/emails/${opened.emailId}?send=1`);
  return { ok: true };
}
