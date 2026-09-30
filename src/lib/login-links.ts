import "server-only";
// Self-service sign-in links ("Forgot password?"): look one up from /login/link/<token>.
// Invalid, used, replaced and expired links all look the same to the visitor.
import { db } from "./db";
import { hashInviteToken, isInviteTokenShape } from "./invite-token";
import { canSignIn, loginLinkState } from "./pipeline";

export async function findUsableLoginLink(token: string) {
  if (!isInviteTokenShape(token)) return null;
  const link = await db.loginLink.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, angelId: true, disabledAt: true, angel: { select: { archivedAt: true } } } } },
  });
  if (!link || loginLinkState(link) !== "ok" || !canSignIn(link.user)) return null;
  return link;
}

/** Log a sign-in link step where the team already looks: a member's activity, or the Team page's log. */
export function loginLinkEvent(user: { id: string; email: string; role: string; angelId: string | null }, kind: string, detail?: string) {
  if (user.role === "ANGEL" && user.angelId) return db.angelEvent.create({ data: { angelId: user.angelId, kind, detail, actorId: user.id } });
  return db.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind, detail, actorId: user.id } });
}
