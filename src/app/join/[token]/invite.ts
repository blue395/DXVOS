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

export type UsableInvite = NonNullable<Awaited<ReturnType<typeof findUsableInvite>>>;

const EXPIRED = "This link has expired or has already been used. Ask the DXV team for a new one.";

/**
 * An invited angel's first login: claims the invite (exactly once), creates the login,
 * records the member terms they accepted, makes a prospect a member, and logs it all.
 * Shared by "Choose a password" and "Continue with Google / Microsoft".
 */
export async function createLoginFromInvite(
  invite: UsableInvite,
  passwordHash: string,
  ip: string | null,
  how: string,
  opts: { providerOnly?: boolean } = {},
): Promise<{ userId: string } | { error: string }> {
  const angel = invite.angel;
  if (invite.kind !== "INVITE") return { error: EXPIRED };
  if (!angel.email) return { error: "Your invite is missing an email address. Ask the DXV team for a new link." };
  if (angel.user) return { error: "You already have a login. Sign in instead." };
  const terms = await db.complianceText.findFirst({ where: { kind: "MEMBER_TERMS", status: "APPROVED" }, select: { id: true, version: true } });
  if (!terms) return { error: "Sign-up is paused just now. Please try again later." };
  const email = angel.email;
  try {
    const userId = await db.$transaction(async (tx) => {
      const claimed = await tx.angelInvite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("claimed");
      // Someone already on the Angel Foundations course has a learner login with this email:
      // accepting the invite makes that same login their member login (one login, progress kept).
      const learner = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, angelId: true } });
      if (learner && (learner.role !== "LEARNER" || learner.angelId)) throw new Error("has-login");
      const user = learner
        ? await tx.user.update({
            where: { id: learner.id },
            data: {
              role: "ANGEL",
              angelId: angel.id,
              lastSignInAt: new Date(),
              sessionVersion: { increment: 1 }, // their access changed: older sessions end
              ...(opts.providerOnly ? {} : { passwordHash }),
            },
          })
        : await tx.user.create({ data: { email, name: angel.name, passwordHash, role: "ANGEL", angelId: angel.id, lastSignInAt: new Date() } });
      await tx.angel.update({
        where: { id: angel.id },
        data: {
          termsAcceptedAt: new Date(),
          termsVersionId: terms.id,
          ageConfirmedAt: new Date(), // ticked on the invite page (both ways of setting up require it)
          // Accepting an invite makes a prospect a member.
          ...(angel.status === "PROSPECT" ? { status: "MEMBER" as const, joinedAt: angel.joinedAt ?? new Date() } : {}),
        },
      });
      await tx.angelEvent.createMany({
        data: [
          { angelId: angel.id, kind: "joined", detail: `${how}${ip ? ` from ${ip}` : ""}`, actorId: user.id },
          { angelId: angel.id, kind: "terms-accepted", detail: `Member terms version ${terms.version}`, actorId: user.id },
          { angelId: angel.id, kind: "age-confirmed", detail: "Confirmed they are 18 or over", actorId: user.id },
        ],
      });
      return user.id;
    });
    return { userId };
  } catch (e) {
    if (e instanceof Error && e.message === "claimed") return { error: EXPIRED };
    if (e instanceof Error && e.message === "has-login") return { error: "You already have a login. Sign in instead." };
    throw e;
  }
}
