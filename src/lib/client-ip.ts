// The visitor's IP address, for rate limits and the records we keep (statement signatures,
// sign-in links). Pure, so it can be tested.
//
// On Netlify, `x-nf-client-connection-ip` is set by Netlify itself and can't be faked. The
// first `x-forwarded-for` entry CAN be faked (a visitor sends their own header and Netlify
// appends to it), so it's only used in local development.
import { createHmac } from "node:crypto";

type HeaderBag = { get(name: string): string | null };

export function clientIp(h: HeaderBag, production = process.env.NODE_ENV === "production"): string | null {
  const netlify = h.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  if (production) return null;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** IPs kept only for rate limiting are stored as a keyed hash, never the address itself. */
export const hashIp = (ip: string | null, secret = process.env.SESSION_SECRET ?? "") =>
  ip ? createHmac("sha256", secret).update(`ip:${ip}`).digest("base64url") : null;
