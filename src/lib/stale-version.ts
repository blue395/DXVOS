// When DXV OS is redeployed while a page is open, that page's server actions can stop
// matching the server ("Server Action ... was not found on the server"). These helpers
// spot that and ask the page to offer a reload. Safe to import from client components.

export const STALE_VERSION_EVENT = "dxv:stale-version";
export const STALE_VERSION_MESSAGE = "DXV OS was updated since this page was opened. Reload the page, then try again.";

/** Next.js's error when a page calls a server action from an older deploy. */
export function isStaleActionError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /Server Action .* was not found on the server|Failed to find Server Action|failed-to-find-server-action/i.test(message);
}

/** Show the "reload to update" banner. */
export function announceStaleVersion() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STALE_VERSION_EVENT));
}

/** For catch blocks: the message to show, flagging the reload banner if the page is out of date. */
export function actionErrorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (isStaleActionError(e)) {
    announceStaleVersion();
    return STALE_VERSION_MESSAGE;
  }
  return e instanceof Error ? e.message : fallback;
}
