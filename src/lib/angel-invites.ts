import "server-only";
// Member invites, shared by the team's invite tools (Angels → Invite an angel, the angel
// page) and approved join requests from shareable sign-up links: one one-time link per
// angel (a new one replaces the old), logged in their activity, emailed with the welcome
// email (Prospects) or the standard invite.

import { db } from "./db";
import { INVITE_DAYS, newInviteToken } from "./invite-token";
import { sendWelcomeEmail, welcomeTemplate } from "./member-emails";
import { usesWelcomeEmail } from "./pipeline";
import { emailSentLink, linkOrigin, type EmailOutcome } from "./send-link";
import type { AngelStatus } from "@/generated/prisma/enums";

/** Why this email can't be given a new portal login (null: it can). */
export async function loginClash(email: string, teamHint: string): Promise<string | null> {
  const clash = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (!clash) return null;
  return clash.role === "ADMIN" ? `That email is a DXV team login. ${teamHint}` : "That email already has a portal login.";
}

/** A new one-time link for an angel (earlier unused links of the same kind stop working), logged. */
export async function issueAngelLink(angelId: string, kind: "INVITE" | "RESET", actorId: string, detail = `Link valid for ${INVITE_DAYS} days`) {
  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db.$transaction([
    db.angelInvite.updateMany({ where: { angelId, kind, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.angelInvite.create({ data: { angelId, kind, tokenHash, expiresAt, createdById: actorId } }),
    db.angelEvent.create({ data: { angelId, kind: kind === "INVITE" ? "invited" : "reset-link", detail, actorId } }),
  ]);
  return { link: `${await linkOrigin()}/join/${token}`, expiresAt };
}

/** Email a link the team just made, and note it in the angel's activity when it goes. */
export async function emailAndLog(
  kind: "MEMBER_INVITE" | "RESET",
  to: string,
  angel: { id: string; name: string; status: AngelStatus },
  link: string,
  expiresAt: Date,
  admin: { id: string; name: string },
  opts: { welcomeOrInvite?: boolean } = {},
): Promise<EmailOutcome> {
  // New applicants (Prospects) get the team's welcome email; everyone else the standard invite.
  // welcomeOrInvite (approved sign-up-link requests: nobody is standing by to copy the link):
  // if the welcome email isn't ready, send the standard invite instead of nothing.
  if (kind === "MEMBER_INVITE" && usesWelcomeEmail(angel.status)) {
    const welcome = opts.welcomeOrInvite ? await welcomeTemplate() : null;
    if (!opts.welcomeOrInvite || (welcome && welcome.problems.length === 0)) return sendWelcomeEmail(angel, to, link, admin.id);
  }
  const out = await emailSentLink(kind, to, { name: angel.name, link, expiresAt, sentBy: admin.name });
  if (out.emailedTo) {
    await db.angelEvent.create({
      data: { angelId: angel.id, kind: "link-emailed", detail: `${kind === "RESET" ? "Password reset link" : "Invite"} emailed to ${to}`, actorId: admin.id },
    });
  }
  return out;
}
