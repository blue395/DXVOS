import "server-only";
// Looks up a one-time team link from /join/team/<token>. Invalid, used, revoked and
// expired links all look the same to the visitor.
import { db } from "@/lib/db";
import { hashInviteToken, isInviteTokenShape } from "@/lib/invite-token";

export async function findUsableTeamInvite(token: string) {
  if (!isInviteTokenShape(token)) return null;
  const invite = await db.teamInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { user: { select: { id: true, disabledAt: true, role: true } } },
  });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) return null;
  if (invite.kind === "RESET" && (!invite.user || invite.user.disabledAt || invite.user.role !== "ADMIN")) return null;
  return invite;
}
