// Signs the request that kicks off the background deck worker. The worker's URL is
// public, so without this anyone could trigger (paid) AI runs. Uses SESSION_SECRET,
// which both the app and the worker already have. Pure; shared with the worker.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createWorkerToken(analysisId: string, secret: string, now = Date.now()): string {
  const payload = `${analysisId}.${now + TTL_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the analysis id if the token is valid and unexpired, else null. */
export function verifyWorkerToken(token: string, secret: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [analysisId, expiresAt, signature] = parts;
  const expected = Buffer.from(sign(`${analysisId}.${expiresAt}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(expiresAt) > now)) return null;
  return analysisId;
}
