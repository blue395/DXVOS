"use server";

// Team logins (DXV partners). Everyone on the team has the same access, including this
// page. Logins are handed out as one-time links (emailed, or copied and sent by hand); access is
// revoked, never deleted. Every step is logged in TeamEvent (append-only).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { INVITE_DAYS, newInviteToken } from "@/lib/invite-token";
import { teamRevokeBlock } from "@/lib/pipeline";
import { emailSentLink, linkOrigin, type EmailOutcome } from "@/lib/send-link";
import type { ActionResult } from "@/lib/action-result";

export type TeamLinkResult =
  | { error: string; /** The email is a member (angel) login: offer to give that same login team access. */ memberLogin?: { userId: string; name: string } }
  | ({ ok: true; link: string; expiresAt: string } & EmailOutcome);

const InviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

async function newLink(
  data: { kind: "INVITE" | "RESET"; email: string; name: string; userId: string | null },
  actor: { id: string; name: string },
  send: boolean,
): Promise<TeamLinkResult> {
  const actorId = actor.id;
  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db.$transaction([
    // Any earlier unused link of the same kind for this person stops working.
    db.teamInvite.updateMany({ where: { email: data.email, kind: data.kind, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.teamInvite.create({ data: { ...data, tokenHash, expiresAt, createdById: actorId } }),
    db.teamEvent.create({
      data: {
        subjectId: data.userId,
        email: data.email,
        kind: data.kind === "INVITE" ? "invited" : "reset-link",
        detail: `${data.kind === "INVITE" ? `Invited ${data.name}` : "Password reset link"}, valid ${INVITE_DAYS} days`,
        actorId,
      },
    }),
  ]);
  const link = `${await linkOrigin()}/join/team/${token}`;
  let emailed: EmailOutcome = {};
  if (send) {
    emailed = await emailSentLink(data.kind === "INVITE" ? "TEAM_INVITE" : "RESET", data.email, { name: data.name, link, expiresAt, sentBy: actor.name });
    if (emailed.emailedTo) {
      await db.teamEvent.create({
        data: { subjectId: data.userId, email: data.email, kind: "link-emailed", detail: `${data.kind === "INVITE" ? "Invite" : "Password reset link"} emailed`, actorId },
      });
    }
  }
  revalidatePath("/team");
  return { ok: true, link, expiresAt: expiresAt.toISOString(), ...emailed };
}

/** A one-time link for a new team login. */
export async function inviteTeamMember(input: { name: string; email: string }, send = false): Promise<TeamLinkResult> {
  const admin = await requireAdmin();
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const clash = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, role: true, disabledAt: true } });
  if (clash?.role === "ANGEL") {
    // Partners are angels too: one login for both, so their member login gets team access.
    return clash.disabledAt
      ? { error: "That email is a member login whose access is revoked. Restore it on their angel page first." }
      : { error: `${clash.name} already signs in to the member portal with this email.`, memberLogin: { userId: clash.id, name: clash.name } };
  }
  if (clash) {
    return {
      error: clash.disabledAt
        ? "That email's team access was revoked. Restore it in the list above instead."
        : "That email already has a team login. Use a password reset link if they're locked out.",
    };
  }
  return newLink({ kind: "INVITE", ...parsed.data, userId: null }, admin, send);
}

/**
 * Give a member's (angel's) existing login team access: the same email and password,
 * now the team app too, with the member portal one click away. For DXV's partners.
 */
export async function grantTeamAccess(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, disabledAt: true, angelId: true } });
  if (!user || user.role !== "ANGEL" || user.disabledAt) return { error: "That member login can't be given team access." };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    db.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind: "member-given-team-access", detail: "Same login, now team and member", actorId: admin.id } }),
    ...(user.angelId
      ? [db.angelEvent.create({ data: { angelId: user.angelId, kind: "given-team-access", detail: `By ${admin.name}`, actorId: admin.id } })]
      : []),
  ]);
  revalidatePath("/team");
  if (user.angelId) revalidatePath(`/angels/${user.angelId}`);
  return { ok: true };
}

/** A one-time link to set a new password (emailed, or copied). */
export async function teamResetLink(userId: string, send = false): Promise<TeamLinkResult> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, disabledAt: true } });
  if (!user || user.role !== "ADMIN") return { error: "Team member not found." };
  if (user.disabledAt) return { error: "Their access is revoked. Restore it first." };
  return newLink({ kind: "RESET", email: user.email, name: user.name, userId: user.id }, admin, send);
}

/** Cancel an invite link that hasn't been used. */
export async function cancelTeamInvite(inviteId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.usedAt || invite.revokedAt) return { error: "That link has already been used or cancelled." };
  await db.$transaction([
    db.teamInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } }),
    db.teamEvent.create({ data: { subjectId: invite.userId, email: invite.email, kind: "link-cancelled", detail: `${invite.name}'s link`, actorId: admin.id } }),
  ]);
  revalidatePath("/team");
  return { ok: true };
}

/** Switch a team login off (signed out everywhere, kept on record) or back on. */
export async function setTeamAccess(userId: string, enabled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const [user, active] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } }),
    db.user.count({ where: { role: "ADMIN", disabledAt: null } }),
  ]);
  if (!user || user.role !== "ADMIN") return { error: "Team member not found." };
  if (!enabled) {
    const block = teamRevokeBlock(admin.id, user.id, active);
    if (block) return { error: block };
  }
  await db.$transaction([
    // sessionVersion: restoring access never revives a session from before the revoke.
    db.user.update({ where: { id: user.id }, data: { disabledAt: enabled ? null : new Date(), sessionVersion: { increment: 1 } } }),
    ...(enabled ? [] : [db.teamInvite.updateMany({ where: { email: user.email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })]),
    db.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind: enabled ? "access-restored" : "access-revoked", actorId: admin.id } }),
  ]);
  revalidatePath("/team");
  return { ok: true };
}
