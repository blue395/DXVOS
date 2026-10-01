// Where Google / Microsoft send people back after "Continue with …". Public: the signed
// state cookie set when they left (lib/oauth.ts) is what ties this to their request.

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { homeFor, getCurrentUser } from "@/lib/auth";
import { connectIdentity, findUserForSignIn, IdentityTakenError, touchIdentity } from "@/lib/identities";
import { loginLinkEvent } from "@/lib/login-links";
import { appOrigin } from "@/lib/mail";
import { OAuthError, PROVIDER_LABEL, finishOAuth, providerFromSlug, type ProviderIdentity } from "@/lib/oauth";
import { canSignIn } from "@/lib/pipeline";
import { createSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createLoginFromInvite, findUsableInvite } from "@/app/join/[token]/invite";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/callback/[provider]">) {
  const { provider: slug } = await ctx.params;
  const provider = providerFromSlug(slug);
  const origin = appOrigin() ?? request.nextUrl.origin;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), { status: 303 });
  if (!provider) return go("/login?signin=failed");

  let identity: ProviderIdentity;
  let intent: Awaited<ReturnType<typeof finishOAuth>>["intent"];
  try {
    ({ identity, intent } = await finishOAuth(provider, request.nextUrl.searchParams));
  } catch (e) {
    const code = e instanceof OAuthError ? e.message : "failed";
    if (!(e instanceof OAuthError)) console.error("OAuth callback failed", e);
    return go(`/login?signin=${code}`);
  }
  const label = PROVIDER_LABEL[provider];

  // Connecting an account to the login they're signed in with (My profile / Account).
  if (intent.kind === "connect") {
    const back = (status: string) => go(`${intent.returnTo}?connect=${status}&provider=${slug}`);
    const me = await getCurrentUser();
    if (!me || me.id !== intent.userId) return go("/login");
    try {
      await connectIdentity(me, identity);
    } catch (e) {
      if (e instanceof IdentityTakenError) return back("taken");
      throw e;
    }
    return back("ok");
  }

  // Setting up their login from an invite: the invite link proved who they are.
  if (intent.kind === "join") {
    const invite = await findUsableInvite(intent.inviteToken);
    if (!invite || invite.kind !== "INVITE") return go(`/join/${intent.inviteToken}`);
    const taken = await db.loginIdentity.findUnique({ where: { provider_subject: { provider, subject: identity.subject } }, select: { removedAt: true } });
    if (taken && !taken.removedAt) return go(`/join/${intent.inviteToken}?signin=taken`);
    // No password yet: they sign in with Google/Microsoft, or set one later with "Forgot your password?".
    const unusable = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const made = await createLoginFromInvite(invite, unusable, ip, `Set up their login with ${label}`);
    if ("error" in made) return go(`/join/${intent.inviteToken}`);
    const user = await db.user.findUniqueOrThrow({ where: { id: made.userId }, select: { id: true, email: true, role: true, angelId: true } });
    await connectIdentity(user, identity);
    await createSession(user.id);
    return go("/portal");
  }

  // Signing in.
  const found = await findUserForSignIn(identity);
  if (!found) return go(`/login?signin=nomatch&provider=${slug}${identity.anyEmail ? `&email=${encodeURIComponent(identity.anyEmail)}` : ""}`);
  if (!canSignIn(found.user)) return go("/login?signin=revoked");
  if (found.newlyConnected) await connectIdentity(found.user, identity);
  else await touchIdentity(identity);
  await Promise.all([
    db.user.update({ where: { id: found.user.id }, data: { lastSignInAt: new Date() } }),
    loginLinkEvent(found.user, "signed-in-with-provider", label),
  ]);
  await createSession(found.user.id);
  return go(homeFor(found.user.role));
}
