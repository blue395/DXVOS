import "server-only";
import { headers } from "next/headers";
import { createWorkerToken } from "./worker-auth";

/**
 * Start a background job. On Netlify, POST to the background function (it replies
 * 202 and keeps running for up to 15 minutes). In local development there is no
 * such endpoint, so run the job in-process instead (a dev server has no timeout).
 * Returns false if the job couldn't be started in production.
 */
export async function triggerBackgroundJob(opts: {
  functionName: string; // e.g. "analyze-deck-background"
  subject: string; // what the signed token names, e.g. an id or "memo:<id>"
  runInline: () => Promise<void>;
}): Promise<boolean> {
  // The site's fixed address when it's set (never trust the request's Host header: public
  // pages like /apply also start jobs, and the signed token must only go to DXV OS itself).
  const fixed = process.env.APP_URL || process.env.URL;
  let origin: string;
  if (fixed) origin = fixed.replace(/\/+$/, "");
  else {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    origin = `${proto}://${host}`;
  }

  try {
    const res = await fetch(`${origin}/.netlify/functions/${opts.functionName}`, {
      method: "POST",
      headers: { "x-dxv-worker-token": createWorkerToken(opts.subject, process.env.SESSION_SECRET!) },
    });
    if (res.status === 202) return true;
  } catch {
    // fall through
  }

  if (process.env.NODE_ENV !== "production" || process.env.DECK_WORKER_INLINE === "true") {
    void opts.runInline(); // fire and forget; the page polls for the result
    return true;
  }
  return false;
}
