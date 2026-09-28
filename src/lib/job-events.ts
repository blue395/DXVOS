// Browser-side signal: "a background job just started", so the job tray looks now
// instead of waiting for its next check. Safe to import from client components.
export const JOB_STARTED_EVENT = "dxv:job-started";

export function announceJobStarted() {
  window.dispatchEvent(new Event(JOB_STARTED_EVENT));
}
