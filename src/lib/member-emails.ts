import "server-only";
// Sending the team's emails to angels: the welcome email that goes with a new applicant's
// invite, and bulk emails in small batches (each recipient claimed once, so nobody gets
// two copies). Every send is logged in the angel's activity.

import { db } from "./db";
import { complianceReady } from "./compliance";
import { INVITE_DAYS, newInviteToken } from "./invite-token";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { firstNameOf, renderMemberEmail, templateProblems } from "./member-email";
import { unsubscribeUrl } from "./unsubscribe";
import type { EmailOutcome } from "./send-link";

/** The welcome template's problems, if any (e.g. the WhatsApp link not filled in yet). */
export async function welcomeTemplate() {
  const t = await db.emailTemplate.findUnique({ where: { key: "welcome" } });
  return t && !t.archivedAt ? { template: t, problems: templateProblems(t) } : null;
}

/** Email a new applicant's invite as the team's welcome email. */
export async function sendWelcomeEmail(angel: { id: string; name: string }, to: string, link: string, actorId: string): Promise<EmailOutcome> {
  if (!mailConfigured() || !appOrigin()) return { emailError: "Email isn't set up, so copy the link below and send it yourself." };
  const w = await welcomeTemplate();
  if (!w) return { emailError: "There's no welcome email template, so copy the link below and send it yourself." };
  if (w.problems.length) return { emailError: `The welcome email needs finishing first (Angels → Email angels → Templates): ${w.problems.join(" ")} Copy the link below instead.` };
  try {
    await sendMail({ to, ...renderMemberEmail(w.template, { first_name: firstNameOf(angel.name), platform_link: link }) });
  } catch (e) {
    console.error("Welcome email failed", e);
    return { emailError: "The email didn't send, so copy the link below and send it yourself." };
  }
  await db.angelEvent.create({ data: { angelId: angel.id, kind: "link-emailed", detail: `Welcome email with invite sent to ${to}`, actorId } });
  return { emailedTo: to };
}

/** A fresh one-time sign-up link for an angel with no login (replaces any unused one), logged like any invite. */
async function freshInviteLink(angelId: string, actorId: string, why: string): Promise<string> {
  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db.$transaction([
    db.angelInvite.updateMany({ where: { angelId, kind: "INVITE", usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.angelInvite.create({ data: { angelId, kind: "INVITE", tokenHash, expiresAt, createdById: actorId } }),
    db.angelEvent.create({ data: { angelId, kind: "invited", detail: `${why}; link valid for ${INVITE_DAYS} days`, actorId } }),
  ]);
  return `${appOrigin()}/join/${token}`;
}

export const BATCH_SIZE = 5;

/**
 * Send the next few recipients of a bulk email. Angels without a login get a new sign-up
 * link in their copy; everyone else's link is the sign-in page. Returns what's left.
 */
export async function sendNextBatch(memberEmailId: string, actorId: string) {
  const email = await db.memberEmail.findUnique({ where: { id: memberEmailId } });
  if (!email) throw new Error("Email not found.");
  const origin = appOrigin();
  if (!mailConfigured() || !origin) throw new Error("Email isn't set up.");
  const batch = await db.memberEmailRecipient.findMany({
    where: { memberEmailId, status: "PENDING" },
    take: BATCH_SIZE,
    include: { angel: { select: { id: true, name: true, email: true, archivedAt: true, emailOptOutAt: true, user: { select: { id: true } } } } },
  });
  let ready: boolean | null = null;
  for (const r of batch) {
    // Claim it first, so two tabs can't send the same copy twice.
    const claimed = await db.memberEmailRecipient.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "SENDING" } });
    if (claimed.count !== 1) continue;
    const fail = (error: string) => db.memberEmailRecipient.update({ where: { id: r.id }, data: { status: "FAILED", error } });
    if (r.angel.archivedAt || r.angel.emailOptOutAt || !r.angel.email) {
      await fail(r.angel.emailOptOutAt ? "Unsubscribed before it went" : "No longer has an email");
      continue;
    }
    try {
      let link = `${origin}/login`;
      const invite = !r.angel.user;
      if (invite) {
        ready ??= (await complianceReady()).ready;
        if (!ready) throw new Error("Invites are paused until the statements and member terms are approved.");
        link = await freshInviteLink(r.angel.id, actorId, `Sign-up link in member email "${email.subject}"`);
      }
      const unsub = await unsubscribeUrl(r.angel.id);
      const mail = renderMemberEmail(email, { first_name: firstNameOf(r.angel.name), platform_link: link }, { unsubscribeUrl: unsub });
      await sendMail({
        to: r.angel.email,
        ...mail,
        headers: { "List-Unsubscribe": `<${unsub.replace("/unsubscribe/", "/api/unsubscribe/")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      await db.$transaction([
        db.memberEmailRecipient.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), email: r.angel.email, invited: invite, error: null } }),
        db.angelEvent.create({ data: { angelId: r.angel.id, kind: "member-email", detail: `"${email.subject}" sent to ${r.angel.email}`, actorId } }),
      ]);
    } catch (e) {
      console.error("Member email failed", r.angel.email, e);
      await fail(e instanceof Error ? e.message.slice(0, 200) : "Didn't send");
    }
  }
  const counts = await db.memberEmailRecipient.groupBy({ by: ["status"], where: { memberEmailId }, _count: true });
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return { sent: n("SENT"), failed: n("FAILED"), pending: n("PENDING"), sending: n("SENDING") };
}
