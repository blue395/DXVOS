"use client";

import { generateDDDocument } from "../dd-actions";
import { ActionButton } from "@/components/action-button";
import { announceJobStarted } from "@/lib/job-events";

export function CreateDDDocumentButton({ ventureId, again }: { ventureId: string; again: boolean }) {
  return (
    <ActionButton run={() => generateDDDocument(ventureId)} variant="accent" pendingLabel="Starting…" onDone={announceJobStarted}>
      {again ? "Create a new DD document" : "Create DD document"}
    </ActionButton>
  );
}
