"use client";

import { generateDDDocument } from "../dd-actions";
import { ActionButton } from "./assessment/assessment-client";

export function CreateDDDocumentButton({ ventureId, again }: { ventureId: string; again: boolean }) {
  return (
    <ActionButton run={() => generateDDDocument(ventureId)} variant="accent">
      {again ? "Create a new DD document" : "Create DD document"}
    </ActionButton>
  );
}
