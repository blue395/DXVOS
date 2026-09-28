// Treat long-stuck deck jobs as failed, so the UI offers a retry instead of
// spinning forever. Pure; used by the actions and the deal page.
const PENDING_TIMEOUT_MS = 15 * 60 * 1000; // upload never finished
const PROCESSING_TIMEOUT_MS = 16 * 60 * 1000; // background functions stop at 15 minutes

export type DeckStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";

export function effectiveDeckStatus(
  a: { status: DeckStatus; error: string | null; createdAt: Date; startedAt: Date | null },
  now: number = Date.now(),
): { status: DeckStatus; error: string | null } {
  if (a.status === "PENDING" && now - a.createdAt.getTime() > PENDING_TIMEOUT_MS) {
    return { status: "FAILED", error: "The upload didn't finish. Try again." };
  }
  if (a.status === "PROCESSING" && a.startedAt && now - a.startedAt.getTime() > PROCESSING_TIMEOUT_MS) {
    return { status: "FAILED", error: "Reading the deck timed out. Try again." };
  }
  return { status: a.status, error: a.error };
}
