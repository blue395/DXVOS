"use client";

import { ActionButton } from "@/components/action-button";
import { announceJobStarted } from "@/lib/job-events";
import { approveOpportunityPack, generateOpportunityPack, reviseOpportunityPack } from "./actions";

export function GeneratePackButton({ round, again }: { round: number; again: boolean }) {
  return (
    <ActionButton run={() => generateOpportunityPack(round)} variant="accent" pendingLabel="Starting…" onDone={announceJobStarted}>
      {again ? "Draft a new pack with AI" : "Draft the pack with AI"}
    </ActionButton>
  );
}

export function ApprovePackButton({ id }: { id: string }) {
  return (
    <ActionButton
      run={() => approveOpportunityPack(id)}
      pendingLabel="Approving…"
      confirm="Approve this pack for members? It will be locked, members with a current investor statement can download it, and it can be attached to emails."
    >
      Approve for members
    </ActionButton>
  );
}

export function RevisePackButton({ id }: { id: string }) {
  return (
    <ActionButton run={() => reviseOpportunityPack(id)} variant="secondary" pendingLabel="Copying…">
      New version from this pack
    </ActionButton>
  );
}
