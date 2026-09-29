"use server";

// Admin controls for an angel's portal access: one-time invite and password-reset links
// (handed out by the team until DXV OS sends email), and revoking or restoring access.
// Every step is logged in AngelEvent.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { complianceReady } from "@/lib/compliance";
import { INVITE_DAYS, newInviteToken } from "@/lib/invite-token";

export type InviteLinkResult = { error: string } | { ok: true; link: string; expiresAt: string };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * A new one-time link for this angel: an invite (first sign-up) or a password reset.
 * Any earlier unused link of the same kind stops working.
 */
export async function createAngelLink(angelId: string, kind: "INVITE" | "RESET"): Promise<InviteLinkResult> {
  const admin = await requireAdmin();
  const [angel, ready] = await Promise.all([
    db.angel.findUnique({ where: { id: angelId }, include: { user: { select: { id: true, disabledAt: true } } } }),
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
            ? "That email already has a DXV team login. Team members don't need a separate angel login: use Preview as angel to see the portal."
            : "That email already has a portal login.",
      };
    }
  } else {
    if (!angel.user) return { error: "They haven't signed up yet. Send an invite link instead." };
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
  return { ok: true, link: `${await origin()}/join/${token}`, expiresAt: expiresAt.toISOString() };
}

/** Switch off an angel's login (they're treated as signed out everywhere). Kept, not deleted. */
export async function setAngelAccess(angelId: string, enabled: boolean): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { angelId }, select: { id: true } });
  if (!user) return { error: "They don't have a login." };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { disabledAt: enabled ? null : new Date() } }),
    ...(enabled ? [] : [db.angelInvite.updateMany({ where: { angelId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })]),
    db.angelEvent.create({ data: { angelId, kind: enabled ? "access-restored" : "access-revoked", actorId: admin.id } }),
  ]);
  revalidatePath(`/angels/${angelId}`);
  return { ok: true };
}
