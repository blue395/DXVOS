// The Anthropic client every background AI job uses, and plain-English messages for
// API errors. Shared with the Netlify workers: relative imports only, no "server-only".
import Anthropic from "@anthropic-ai/sdk";

/**
 * Background jobs can run for up to 15 minutes, so they ride out short API blips:
 * the SDK retries overloads (529), outages (5xx) and rate limits (429) with backoff
 * (about a minute in total at 6 retries) before giving up.
 */
export const WORKER_MAX_RETRIES = 6;

export function workerAnthropic(): Anthropic {
  return new Anthropic({ maxRetries: WORKER_MAX_RETRIES });
}

/** What to tell the team when Claude's API fails (after the retries). */
export function apiErrorMessage(e: { status?: number | null; type?: string | null }): string {
  const s = e.status ?? null;
  if (s === 529 || s === 503 || e.type === "overloaded_error") {
    return "Claude is busy right now (Anthropic's service is overloaded or briefly unavailable). Try again in a few minutes; status.anthropic.com shows any outage.";
  }
  if (s === 402 || e.type === "billing_error") return "The Anthropic account is out of credit. Top it up in the Claude Console (Billing), then try again.";
  if (s === 401 || s === 403) return "The Claude API key was rejected. Check ANTHROPIC_API_KEY in Netlify's environment variables.";
  if (s === 429) return "DXV's Claude usage limit was reached. Try again in a minute.";
  if (s && s >= 500) return `Anthropic's service had an error (${s}). Try again in a few minutes.`;
  return `Claude API error (${s ?? "network"}). Try again in a minute.`;
}
