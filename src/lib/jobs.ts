// Background AI jobs as the job tray sees them. Pure (shared by the API route and the tray).
import type { DeckStatus } from "./deck-status";

export type JobKind = "eligibility" | "assessment" | "dd";

export const JOB_KINDS: Record<JobKind, { label: string; expectedSeconds: number; usually: string }> = {
  eligibility: { label: "Eligibility screen", expectedSeconds: 45, usually: "usually under a minute" },
  assessment: { label: "Investment assessment", expectedSeconds: 120, usually: "usually 1 to 3 minutes" },
  dd: { label: "DD document", expectedSeconds: 120, usually: "usually 1 to 3 minutes" },
};

/** How far back the tray looks (a background function stops after 15 minutes). */
export const JOB_WINDOW_MS = 20 * 60 * 1000;

export type Job = {
  id: string;
  kind: JobKind;
  ventureName: string;
  href: string;
  status: DeckStatus;
  error: string | null;
  startedAt: string; // ISO
  /** Result name to show when done, e.g. "AI Draft 2". */
  result: string | null;
};

export const isRunning = (j: Pick<Job, "status">) => j.status === "PENDING" || j.status === "PROCESSING";

/**
 * Estimated progress (0 to 95%) for a job with no real progress signal: moves
 * quickly at first, slows as it approaches the usual duration, never claims done.
 */
export function estimatedProgress(elapsedMs: number, expectedSeconds: number): number {
  if (elapsedMs <= 0) return 2;
  const pct = 95 * (1 - Math.exp((-1.6 * elapsedMs) / (expectedSeconds * 1000)));
  return Math.max(2, Math.min(95, Math.round(pct)));
}

/** "0:07", "2:15". */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
