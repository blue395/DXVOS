import "server-only";
// "Continue with Google / Microsoft": OpenID Connect, authorisation code flow with PKCE.
//
//   1. beginOAuth() puts a short-lived signed cookie (state, PKCE verifier, nonce, what the
//      person is doing) in the browser and returns the provider's sign-in URL.
//   2. The provider sends them back to /api/auth/callback/<provider>; finishOAuth() checks
//      the state, swaps the code for tokens, and verifies the ID token's signature,
//      audience, issuer and nonce.
// A provider is switched on by its client id + secret (docs/DEPLOY.md §10) and needs APP_URL.

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import type { OAuthProvider } from "@/generated/prisma/enums";
import { appOrigin } from "./mail";
import { microsoftVerifiedEmail } from "./pipeline";

export const PROVIDER_LABEL: Record<OAuthProvider, string> = { GOOGLE: "Google", MICROSOFT: "Microsoft" };
export const providerSlug = (p: OAuthProvider) => p.toLowerCase();
export const providerFromSlug = (s: string): OAuthProvider | null => (s === "google" ? "GOOGLE" : s === "microsoft" ? "MICROSOFT" : null);

const LIVE = {
  GOOGLE: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
  },
  MICROSOFT: {
    // "common": work/school and personal Microsoft accounts.
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    jwks: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
  },
} as const;

/**
 * Endpoints. Local development and tests can point both providers at a stand-in server
 * (OAUTH_DEV_SERVER); production builds ignore it and always use Google's and Microsoft's.
 */
function endpoints(p: OAuthProvider) {
  const dev = process.env.NODE_ENV !== "production" ? process.env.OAUTH_DEV_SERVER : undefined;
  if (!dev) return LIVE[p];
  const base = `${dev.replace(/\/+$/, "")}/${providerSlug(p)}`;
  return { authorize: `${base}/authorize`, token: `${base}/token`, jwks: `${base}/jwks` };
}

const CONFIG = {
  GOOGLE: { id: () => process.env.GOOGLE_CLIENT_ID, secret: () => process.env.GOOGLE_CLIENT_SECRET },
  MICROSOFT: { id: () => process.env.MICROSOFT_CLIENT_ID, secret: () => process.env.MICROSOFT_CLIENT_SECRET },
} as const;

/** The providers that are set up (client id + secret, and a fixed site address for the callback). */
export function enabledProviders(): OAuthProvider[] {
  if (!appOrigin()) return [];
  return (Object.keys(CONFIG) as OAuthProvider[]).filter((p) => CONFIG[p].id() && CONFIG[p].secret());
}

const callbackUrl = (p: OAuthProvider) => `${appOrigin()}/api/auth/callback/${providerSlug(p)}`;

/** What the person is doing: signing in, connecting an account while signed in, or setting up their login from an invite. */
export type OAuthIntent = { kind: "signin" } | { kind: "connect"; userId: string; returnTo: string } | { kind: "join"; inviteToken: string };

const COOKIE = "dxv_oauth";
const COOKIE_PATH = "/api/auth";
const b64url = (buf: Buffer) => buf.toString("base64url");
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function beginOAuth(provider: OAuthProvider, intent: OAuthIntent): Promise<string> {
  if (!enabledProviders().includes(provider)) throw new Error(`${PROVIDER_LABEL[provider]} sign-in isn't set up.`);
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const token = await new SignJWT({ purpose: "oauth", provider, state, nonce, verifier, intent })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: COOKIE_PATH, maxAge: 600 });
  const c = CONFIG[provider];
  const url = new URL(endpoints(provider).authorize);
  url.search = new URLSearchParams({
    client_id: c.id()!,
    redirect_uri: callbackUrl(provider),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account", // let people pick which Google/Microsoft account to use
  }).toString();
  return url.toString();
}

/** Who the provider says signed in. `email` is set only when the provider vouches for it. */
export type ProviderIdentity = { provider: OAuthProvider; subject: string; email: string | null; anyEmail: string | null; name: string | null };

export class OAuthError extends Error {}

// Signing keys, fetched from the provider and cached (jose refreshes them when they rotate).
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(p: OAuthProvider) {
  const url = endpoints(p).jwks;
  if (!keySets.has(url)) keySets.set(url, createRemoteJWKSet(new URL(url)));
  return keySets.get(url)!;
}

export async function finishOAuth(provider: OAuthProvider, params: URLSearchParams): Promise<{ identity: ProviderIdentity; intent: OAuthIntent }> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: COOKIE_PATH });
  if (params.get("error")) throw new OAuthError("cancelled");
  if (!raw) throw new OAuthError("expired");
  let saved: { provider: string; state: string; nonce: string; verifier: string; intent: OAuthIntent };
  try {
    const { payload } = await jwtVerify(raw, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "oauth") throw new Error();
    saved = payload as unknown as typeof saved;
  } catch {
    throw new OAuthError("expired");
  }
  const code = params.get("code");
  if (saved.provider !== provider || !code || params.get("state") !== saved.state) throw new OAuthError("expired");

  const c = CONFIG[provider];
  const res = await fetch(endpoints(provider).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(provider),
      client_id: c.id()!,
      client_secret: c.secret()!,
      code_verifier: saved.verifier,
    }),
  });
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !tokens.id_token) {
    console.error(`${provider} token exchange failed`, res.status, tokens.error, tokens.error_description);
    throw new OAuthError("failed");
  }

  const { payload: claims } = await jwtVerify(tokens.id_token, jwks(provider), { audience: c.id()! }).catch((e) => {
    console.error(`${provider} ID token didn't verify`, e);
    throw new OAuthError("failed");
  });
  const iss = String(claims.iss ?? "");
  const issuerOk = provider === "GOOGLE" ? iss === "https://accounts.google.com" || iss === "accounts.google.com" : iss === `https://login.microsoftonline.com/${String(claims.tid)}/v2.0`;
  if (!issuerOk || claims.nonce !== saved.nonce || typeof claims.sub !== "string") throw new OAuthError("failed");

  const anyEmail = typeof claims.email === "string" ? claims.email.toLowerCase() : typeof claims.preferred_username === "string" && claims.preferred_username.includes("@") ? claims.preferred_username.toLowerCase() : null;
  const email =
    provider === "GOOGLE" ? (claims.email_verified === true && typeof claims.email === "string" ? claims.email.toLowerCase() : null) : microsoftVerifiedEmail(claims as Record<string, unknown>);
  return {
    identity: { provider, subject: claims.sub, email, anyEmail, name: typeof claims.name === "string" ? claims.name : null },
    intent: saved.intent,
  };
}
