import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

// Stateless session: a signed (HS256) JWT in an HttpOnly cookie.
// The payload is deliberately minimal: the user id and the login's session version.
// Everything else is looked up fresh from the database on each request (see auth.ts).
// Bumping User.sessionVersion (signOutEverywhere()) ends every existing session for
// that login: password resets, email changes, revoking access, "Sign out everywhere".

import { SESSION_COOKIE } from "./session-cookie";
const SESSION_DAYS = 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

/** Sign this browser in. Reads the login's current session version, so call it after any signOutEverywhere(). */
export async function createSession(userId: string) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { sessionVersion } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await new SignJWT({ sub: userId, v: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** The signed-in user id and the session version it was issued with (sessions from before versions count as 0). */
export async function readSession(): Promise<{ userId: string; version: number } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

/** End every session this login has, on every device. Use the returned data in a transaction, or await it. */
export const signOutEverywhere = (userId: string) => db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
