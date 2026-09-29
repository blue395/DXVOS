import "server-only";
// Looks up a one-time link from /join/<token>. Invalid, used, revoked and expired links
// all look the same to the visitor.
import { db } from "@/lib/db";
import { hashInviteToken, isInviteTokenShape } from "@/lib/invite-token";

export async function findUsableInvite(token: string) {
  if (!isInviteTokenShape(token)) return null;
  const invite = await db.angelInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { angel: { include: { user: { select: { id: true, disabledAt: true } } } } },
  });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date() || invite.angel.archivedAt) return null;
  return invite;
}
