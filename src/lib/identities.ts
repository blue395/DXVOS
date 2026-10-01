import "server-only";
// Google / Microsoft accounts connected to DXV logins (LoginIdentity). Matching is by the
// provider's id for the person; an email is only used to find someone the first time, and
// only when the provider vouches for it (see microsoftVerifiedEmail()).

import { db } from "./db";
import { loginLinkEvent } from "./login-links";
import { PROVIDER_LABEL, type ProviderIdentity } from "./oauth";

const userSelect = { id: true, email: true, name: true, role: true, angelId: true, disabledAt: true, angel: { select: { archivedAt: true } } } as const;

/** The login this provider account signs in to: a connected one, else a login with the same provider-verified email (which it then connects). */
export async function findUserForSignIn(identity: ProviderIdentity) {
  const linked = await db.loginIdentity.findUnique({
    where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    select: { removedAt: true, user: { select: userSelect } },
  });
  if (linked && !linked.removedAt) return { user: linked.user, newlyConnected: false };
  if (!identity.email) return null;
  const user = await db.user.findUnique({ where: { email: identity.email }, select: userSelect });
  return user ? { user, newlyConnected: true } : null;
}

export class IdentityTakenError extends Error {}

/** Connect (or reconnect) a provider account to this login. Refuses one already connected to someone else. */
export async function connectIdentity(user: { id: string; email: string; role: string; angelId: string | null }, identity: ProviderIdentity) {
  const where = { provider_subject: { provider: identity.provider, subject: identity.subject } };
  const existing = await db.loginIdentity.findUnique({ where, select: { userId: true, removedAt: true, email: true } });
  if (existing && !existing.removedAt && existing.userId !== user.id) throw new IdentityTakenError();
  const fresh = !existing || existing.removedAt || existing.userId !== user.id;
  await db.loginIdentity.upsert({
    where,
    create: { userId: user.id, provider: identity.provider, subject: identity.subject, email: identity.email ?? identity.anyEmail, emailVerified: !!identity.email, lastUsedAt: new Date() },
    update: {
      userId: user.id,
      email: identity.email ?? identity.anyEmail,
      emailVerified: !!identity.email,
      lastUsedAt: new Date(),
      removedAt: null,
      // A new connection, or a different email on it, gets a fresh "use this email?" offer.
      ...(fresh || existing?.email !== (identity.email ?? identity.anyEmail) ? { emailChoiceAt: null } : {}),
    },
  });
  if (fresh) await loginLinkEvent(user, "sign-in-connected", `${PROVIDER_LABEL[identity.provider]} account ${identity.email ?? identity.anyEmail ?? ""}`.trim());
}

/** Note a sign-in with an already-connected account. */
export async function touchIdentity(identity: ProviderIdentity) {
  await db.loginIdentity.update({
    where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    data: { lastUsedAt: new Date(), email: identity.email ?? identity.anyEmail, emailVerified: !!identity.email },
  });
}
