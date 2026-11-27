"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { saveWelcome } from "../actions";

/** The welcome questions; on saving, the course opens with a full page load. */
export function WelcomeForm({ children }: { children: React.ReactNode }) {
  return (
    // A full page load on purpose: /learn is a whole page of its own, not one of the app's pages.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    <ActionForm action={saveWelcome} resetOnSuccess={false} onSuccess={() => window.location.assign("/learn")} className="space-y-6">
      {children}
      <SubmitButton pendingLabel="Saving…" doneLabel="Saved">
        Start the course
      </SubmitButton>
    </ActionForm>
  );
}
