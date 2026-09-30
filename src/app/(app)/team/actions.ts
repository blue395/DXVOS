"use server";

// Team logins (DXV partners). Everyone on the team has the same access, including this
// page. Logins are handed out as one-time links (no email service yet); access is
// revoked, never deleted. Every step is logged in TeamEvent (append-only).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { INVITE_DAYS, newInviteToken } from "@/lib/invite-token";
import { teamRevokeBlock } from "@/lib/pipeline";
import { requestOrigin } from "@/lib/request-origin";
import type { ActionResult } from "@/lib/action-result";

export type TeamLinkResult = { error: string } | { ok: true; link: string; expiresAt: string };

const InviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

async function newLink(data: { kind: "INVITE" | "RESET"; email: string; name: string; userId: string | null }, actorId: string): Promise<TeamLinkResult> {
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
  revalidatePath("/team");
  return { ok: true, link: `${await requestOrigin()}/join/team/${token}`, expiresAt: expiresAt.toISOString() };
}

/** A one-time link for a new team login. */
export async function inviteTeamMember(input: { name: string; email: string }): Promise<TeamLinkResult> {
  const admin = await requireAdmin();
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const clash = await db.user.findUnique({ where: { email: parsed.data.email }, select: { role: true, disabledAt: true } });
  if (clash) {
    return {
      error:
        clash.role === "ADMIN"
          ? clash.disabledAt
            ? "That email's team access was revoked. Restore it in the list above instead."
            : "That email already has a team login. Use a password reset link if they're locked out."
          : "That email is a member (angel) portal login. Use a different email, such as their DXV address, for their team login.",
    };
  }
  return newLink({ kind: "INVITE", ...parsed.data, userId: null }, admin.id);
}

/** A one-time link to set a new password (while there's no email service). */
export async function teamResetLink(userId: string): Promise<TeamLinkResult> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, disabledAt: true } });
  if (!user || user.role !== "ADMIN") return { error: "Team member not found." };
  if (user.disabledAt) return { error: "Their access is revoked. Restore it first." };
  return newLink({ kind: "RESET", email: user.email, name: user.name, userId: user.id }, admin.id);
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
    db.user.update({ where: { id: user.id }, data: { disabledAt: enabled ? null : new Date() } }),
    ...(enabled ? [] : [db.teamInvite.updateMany({ where: { email: user.email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })]),
    db.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind: enabled ? "access-restored" : "access-revoked", actorId: admin.id } }),
  ]);
  revalidatePath("/team");
  return { ok: true };
}
