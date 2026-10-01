"use server";

// Admin controls for an angel's portal access: one-time invite and password-reset links
// (handed out by the team until DXV OS sends email), and revoking or restoring access.
// Every step is logged in AngelEvent.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { complianceReady } from "@/lib/compliance";
import { INVITE_DAYS, newInviteToken } from "@/lib/invite-token";
import { emailSentLink, linkOrigin, type EmailOutcome } from "@/lib/send-link";
import { sendWelcomeEmail } from "@/lib/member-emails";
import { usesWelcomeEmail } from "@/lib/pipeline";
import type { AngelStatus } from "@/generated/prisma/enums";

export type InviteLinkResult = { error: string } | ({ ok: true; link: string; expiresAt: string } & EmailOutcome);

/**
 * A new one-time link for this angel: an invite (first sign-up) or a password reset.
 * Any earlier unused link of the same kind stops working.
 */
export async function createAngelLink(angelId: string, kind: "INVITE" | "RESET", send = false): Promise<InviteLinkResult> {
  const admin = await requireAdmin();
  const [angel, ready] = await Promise.all([
    db.angel.findUnique({ where: { id: angelId }, include: { user: { select: { id: true, email: true, disabledAt: true, role: true } } } }),
    complianceReady(),
  ]);
  if (!angel || angel.archivedAt) return { error: "Angel not found." };
  if (kind === "INVITE") {
    if (!ready.ready) return { error: "Approve the investor statements and member terms first (Angels → Statements & terms)." };
    if (!angel.email) return { error: "Add their email first: it becomes their login." };
    if (angel.user) return { error: "They already have a login. Use a password reset link instead." };
    const clash = await loginClash(angel.email, "Use Link to a team login below: one login for the team app and their member portal.");
    if (clash) return { error: clash };
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
  const link = `${await linkOrigin()}/join/${token}`;
  // An invite goes to the angel's email (their future login); a reset to their login's email.
  const to = kind === "INVITE" ? angel.email : angel.user?.email;
  const emailed = send && to ? await emailAndLog(kind === "INVITE" ? "MEMBER_INVITE" : "RESET", to, angel, link, expiresAt, admin) : {};
  revalidatePath(`/angels/${angelId}`);
  return { ok: true, link, expiresAt: expiresAt.toISOString(), ...emailed };
}

/** Email a link the team just made, and note it in the angel's activity when it goes. */
async function emailAndLog(
  kind: "MEMBER_INVITE" | "RESET",
  to: string,
  angel: { id: string; name: string; status: AngelStatus },
  link: string,
  expiresAt: Date,
  admin: { id: string; name: string },
): Promise<EmailOutcome> {
  // New applicants (Prospects) get the team's welcome email; everyone else the standard invite.
  if (kind === "MEMBER_INVITE" && usesWelcomeEmail(angel.status)) return sendWelcomeEmail(angel, to, link, admin.id);
  const out = await emailSentLink(kind, to, { name: angel.name, link, expiresAt, sentBy: admin.name });
  if (out.emailedTo) {
    await db.angelEvent.create({
      data: { angelId: angel.id, kind: "link-emailed", detail: `${kind === "RESET" ? "Password reset link" : "Invite"} emailed to ${to}`, actorId: admin.id },
    });
  }
  return out;
}

/** Why this email can't be given a new portal login (null: it can). */
async function loginClash(email: string, teamHint: string): Promise<string | null> {
  const clash = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (!clash) return null;
  return clash.role === "ADMIN" ? `That email is a DXV team login. ${teamHint}` : "That email already has a portal login.";
}

export type NewInviteResult = { error: string; existingAngelId?: string } | ({ ok: true; angelId: string; link: string; expiresAt: string } & EmailOutcome);

const NewInviteSchema = z.object({
  name: z.string().trim().min(1, "Add their name").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("That email isn't valid")),
});

/**
 * Invite someone new in one step: adds them as a Prospect (onboarding makes them a Member)
 * and returns their one-time sign-up link. Someone already in the directory is invited
 * from their own page instead, so nobody gets two records.
 */
export async function inviteNewAngel(input: { name: string; email: string }, send = false): Promise<NewInviteResult> {
  const admin = await requireAdmin();
  const parsed = NewInviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { name, email } = parsed.data;
  const [ready, existing] = await Promise.all([complianceReady(), db.angel.findUnique({ where: { email }, select: { id: true, name: true } })]);
  if (!ready.ready) return { error: "Approve the investor statements and member terms first (Angels → Statements & terms)." };
  if (existing) return { error: `${existing.name} is already in the directory with that email: invite them from their page.`, existingAngelId: existing.id };
  const clash = await loginClash(email, "Partners get member access from the Member portal button in the team app.");
  if (clash) return { error: clash };

  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const angel = await db.$transaction(async (tx) => {
    const a = await tx.angel.create({ data: { name, email, status: "PROSPECT", source: "Invited", createdById: admin.id } });
    await tx.angelInvite.create({ data: { angelId: a.id, kind: "INVITE", tokenHash, expiresAt, createdById: admin.id } });
    await tx.angelEvent.create({ data: { angelId: a.id, kind: "invited", detail: `Link valid for ${INVITE_DAYS} days`, actorId: admin.id } });
    return a;
  });
  const link = `${await linkOrigin()}/join/${token}`;
  const emailed = send ? await emailAndLog("MEMBER_INVITE", email, angel, link, expiresAt, admin) : {};
  revalidatePath("/angels");
  revalidatePath("/");
  return { ok: true, angelId: angel.id, link, expiresAt: expiresAt.toISOString(), ...emailed };
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
