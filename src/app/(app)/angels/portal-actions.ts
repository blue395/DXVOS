"use server";

// Admin controls for an angel's portal access: one-time invite and password-reset links
// (handed out by the team until DXV OS sends email), and revoking or restoring access.
// Every step is logged in AngelEvent.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { complianceReady } from "@/lib/compliance";
import { INVITE_DAYS, newInviteToken } from "@/lib/invite-token";
import { requestOrigin } from "@/lib/request-origin";

export type InviteLinkResult = { error: string } | { ok: true; link: string; expiresAt: string };

/**
 * A new one-time link for this angel: an invite (first sign-up) or a password reset.
 * Any earlier unused link of the same kind stops working.
 */
export async function createAngelLink(angelId: string, kind: "INVITE" | "RESET"): Promise<InviteLinkResult> {
  const admin = await requireAdmin();
  const [angel, ready] = await Promise.all([
    db.angel.findUnique({ where: { id: angelId }, include: { user: { select: { id: true, disabledAt: true, role: true } } } }),
    complianceReady(),
  ]);
  if (!angel || angel.archivedAt) return { error: "Angel not found." };
  if (kind === "INVITE") {
    if (!ready.ready) return { error: "Approve the investor statements and member terms first (Angels → Statements & terms)." };
    if (!angel.email) return { error: "Add their email first: it becomes their login." };
    if (angel.user) return { error: "They already have a login. Use a password reset link instead." };
    const clash = await db.user.findUnique({ where: { email: angel.email }, select: { role: true } });
    if (clash) {
      return {
        error:
          clash.role === "ADMIN"
            ? "That email is a DXV team login. Use Link to a team login below: one login for the team app and their member portal."
            : "That email already has a portal login.",
      };
    }
  } else {
    if (!angel.user) return { error: "They haven't signed up yet. Send an invite link instead." };
    if (angel.user.role === "ADMIN") return { error: "They sign in with their team login: make a password reset link on the Team page." };
    if (angel.user.disabledAt) return { error: "Their access is revoked. Restore it first." };
  }

  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db.$transaction([
    db.angelInvite.updateMany({ where: { angelId, kind, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.angelInvite.create({ data: { angelId, kind, tokenHash, expiresAt, createdById: admin.id } }),
    db.angelEvent.create({
      data: { angelId, kind: kind === "INVITE" ? "invited" : "reset-link", detail: `Link valid for ${INVITE_DAYS} days`, actorId: admin.id },
    }),
  ]);
  revalidatePath(`/angels/${angelId}`);
  return { ok: true, link: `${await requestOrigin()}/join/${token}`, expiresAt: expiresAt.toISOString() };
}

/** Switch off an angel's login (they're treated as signed out everywhere). Kept, not deleted. */
export async function setAngelAccess(angelId: string, enabled: boolean): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { angelId }, select: { id: true, role: true } });
  if (!user) return { error: "They don't have a login." };
  if (user.role === "ADMIN") return { error: "They sign in with their team login: manage it on the Team page." };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { disabledAt: enabled ? null : new Date() } }),
    ...(enabled ? [] : [db.angelInvite.updateMany({ where: { angelId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })]),
    db.angelEvent.create({ data: { angelId, kind: enabled ? "access-restored" : "access-revoked", actorId: admin.id } }),
  ]);
  revalidatePath(`/angels/${angelId}`);
  return { ok: true };
}

/**
 * A partner's team login becomes their member login too: link it to this angel record,
 * so they reach the member portal (as this angel, under the same rules as every member)
 * without a second login.
 */
export async function linkTeamLogin(angelId: string, userId: string): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const [angel, user] = await Promise.all([
    db.angel.findUnique({ where: { id: angelId }, select: { id: true, name: true, archivedAt: true, user: { select: { id: true } } } }),
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, angelId: true, disabledAt: true } }),
  ]);
  if (!angel || angel.archivedAt) return { error: "Angel not found." };
  if (angel.user) return { error: "This angel already has a login." };
  if (!user || user.role !== "ADMIN" || user.disabledAt) return { error: "Choose an active team member." };
  if (user.angelId) return { error: `${user.name}'s login is already linked to another angel record.` };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { angelId: angel.id } }),
    db.angelInvite.updateMany({ where: { angelId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.angelEvent.create({ data: { angelId, kind: "linked-team-login", detail: `${user.name}'s team login (${user.email})`, actorId: admin.id } }),
    db.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind: "member-linked", detail: `Angel record: ${angel.name}`, actorId: admin.id } }),
  ]);
  revalidatePath(`/angels/${angelId}`);
  revalidatePath("/team");
  return { ok: true };
}
