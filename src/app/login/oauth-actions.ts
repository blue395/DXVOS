"use server";

// "Continue with Google / Microsoft", connecting those accounts to a login, and switching
// a login's email to a connected account's (provider-verified) email. Every action that
// changes a login acts only on the signed-in person's own login.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OAuthProvider } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { db } from "@/lib/db";
import { emailChangedEmail } from "@/lib/login-email";
import { loginLinkEvent } from "@/lib/login-links";
import { appOrigin, mailConfigured, sendMail } from "@/lib/mail";
import { PROVIDER_LABEL, beginOAuth, enabledProviders } from "@/lib/oauth";
import { findUsableInvite } from "@/app/join/[token]/invite";

const ACCOUNT_PAGES = ["/portal/profile", "/account"] as const;
type AccountPage = (typeof ACCOUNT_PAGES)[number];

const notSetUp = (p: OAuthProvider) => ({ error: `${PROVIDER_LABEL[p]} sign-in isn't set up yet.` });

/** Sign-in page: off to Google / Microsoft. */
export async function startProviderSignIn(provider: OAuthProvider): Promise<ActionResult> {
  if (!enabledProviders().includes(provider)) return notSetUp(provider);
  redirect(await beginOAuth(provider, { kind: "signin" }));
}

/** My profile / Account: connect a Google or Microsoft account to the signed-in login. */
export async function startProviderConnect(provider: OAuthProvider, returnTo: AccountPage): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!ACCOUNT_PAGES.includes(returnTo)) return { error: "Unknown page." };
  if (!enabledProviders().includes(provider)) return notSetUp(provider);
  redirect(await beginOAuth(provider, { kind: "connect", userId: me.id, returnTo }));
}

/** Invite page: set up the login with Google / Microsoft instead of a password (terms first). */
export async function startProviderJoin(token: string, provider: OAuthProvider, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (formData.get("terms") !== "on") return { error: "Please read and accept the member terms first." };
  const invite = await findUsableInvite(token);
  if (!invite || invite.kind !== "INVITE") return { error: "This link has expired or has already been used. Ask the DXV team for a new one." };
  if (!enabledProviders().includes(provider)) return notSetUp(provider);
  redirect(await beginOAuth(provider, { kind: "join", inviteToken: token }));
}

function revalidateAccount() {
  revalidatePath("/portal/profile");
  revalidatePath("/account");
  revalidatePath("/portal");
}

/** Disconnect one of my Google / Microsoft accounts (kept on record, marked removed). */
export async function disconnectIdentity(identityId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const idn = await db.loginIdentity.findFirst({ where: { id: identityId, userId: me.id, removedAt: null } });
  if (!idn) return { error: "That account isn't connected." };
  await db.$transaction([
    db.loginIdentity.update({ where: { id: idn.id }, data: { removedAt: new Date() } }),
    loginLinkEvent(me, "sign-in-disconnected", `${PROVIDER_LABEL[idn.provider]} account ${idn.email ?? ""}`.trim()),
  ]);
  revalidateAccount();
  return { ok: true };
}

/** Keep my current DXV email (stop offering the connected account's one). */
export async function keepMyEmail(identityId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  await db.loginIdentity.updateMany({ where: { id: identityId, userId: me.id }, data: { emailChoiceAt: new Date() } });
  revalidateAccount();
  return { ok: true };
}

/**
 * Make a connected account's email my DXV email (login, and a member's contact email).
 * Only an email the provider vouches for, and only if no one else uses it. The old
 * address is told, in case it wasn't them.
 */
export async function switchToIdentityEmail(identityId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const idn = await db.loginIdentity.findFirst({ where: { id: identityId, userId: me.id, removedAt: null, emailVerified: true } });
  if (!idn?.email) return { error: "That account's email can't be used: connect it again, or ask the DXV team." };
  const newEmail = idn.email.toLowerCase();
  const oldEmail = me.email;
  if (newEmail === oldEmail.toLowerCase()) {
    await keepMyEmail(idn.id);
    return { ok: true };
  }
  // A member's contact email is their login email; a partner's angel record keeps its own.
  const syncAngel = me.role === "ANGEL" && !!me.angelId;
  const [userClash, angelClash] = await Promise.all([
    db.user.findUnique({ where: { email: newEmail }, select: { id: true } }),
    syncAngel ? db.angel.findUnique({ where: { email: newEmail }, select: { id: true } }) : null,
  ]);
  if ((userClash && userClash.id !== me.id) || (angelClash && angelClash.id !== me.angelId)) {
    return { error: `${newEmail} is already used by another DXV record. Ask the DXV team to sort it out.` };
  }
  const via = PROVIDER_LABEL[idn.provider];
  await db.$transaction([
    // A new login email ends every other session; this browser is signed in again below.
    db.user.update({ where: { id: me.id }, data: { email: newEmail, sessionVersion: { increment: 1 } } }),
    ...(syncAngel ? [db.angel.update({ where: { id: me.angelId! }, data: { email: newEmail } })] : []),
    db.loginIdentity.update({ where: { id: idn.id }, data: { emailChoiceAt: new Date() } }),
    // Links emailed to the old address stop working.
    db.loginLink.updateMany({ where: { userId: me.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    loginLinkEvent(me, "login-email-changed", `${oldEmail} to ${newEmail} (chosen by them, verified by ${via})`),
  ]);
  await createSession(me.id);
  const origin = appOrigin();
  if (mailConfigured() && origin) {
    await sendMail({ to: oldEmail, ...emailChangedEmail({ name: me.name, oldEmail, newEmail, via, signInUrl: `${origin}/login` }) }).catch((e) =>
      console.error("Couldn't send the email-changed notice", e),
    );
  }
  revalidateAccount();
  if (me.angelId) revalidatePath(`/angels/${me.angelId}`);
  return { ok: true };
}
