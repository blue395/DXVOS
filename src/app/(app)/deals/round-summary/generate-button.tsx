"use client";

import { ActionButton } from "@/components/action-button";
import { announceJobStarted } from "@/lib/job-events";
import { generateRoundSummary } from "./actions";

export function GenerateSummaryButton({ round, again }: { round: number; again: boolean }) {
  return (
    <ActionButton run={() => generateRoundSummary(round)} variant="accent" pendingLabel="Starting…" onDone={announceJobStarted}>
      {again ? "Generate a new summary" : "Generate partner summary"}
    </ActionButton>
  );
}
