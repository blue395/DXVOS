import "server-only";
// Unsubscribe links in bulk emails: a signed token naming the angel (no expiry, so an old
// email's link still works). Unsubscribing stops bulk emails only; invites and password
// resets still go.
import { SignJWT, jwtVerify } from "jose";
import { appOrigin } from "./mail";

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function unsubscribeUrl(angelId: string): Promise<string> {
  const token = await new SignJWT({ purpose: "unsubscribe", angel: angelId }).setProtectedHeader({ alg: "HS256" }).sign(key());
  return `${appOrigin()}/unsubscribe/${token}`;
}

export async function angelFromUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.purpose === "unsubscribe" && typeof payload.angel === "string" ? payload.angel : null;
  } catch {
    return null;
  }
}
