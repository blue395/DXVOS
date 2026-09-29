// One-time invite / reset links. The link carries a random token; the database stores
// only its SHA-256 hash, so a database leak can't be used to sign up as someone.
// Pure (node:crypto only).
import { createHash, randomBytes } from "node:crypto";

export const INVITE_DAYS = 14;

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url"); // 256 bits
  return { token, tokenHash: hashInviteToken(token) };
}

/** Only well-formed tokens reach the database. */
export const isInviteTokenShape = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);
