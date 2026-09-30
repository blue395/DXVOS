"use client";

import { ActionButton } from "@/components/action-button";
import { adoptSuggestedOneLiner } from "../actions";

/** Make the suggested one-liner the deal's one-line description (what members see too). */
export function AdoptOneLinerButton({ ventureId }: { ventureId: string }) {
  return (
    <ActionButton run={() => adoptSuggestedOneLiner(ventureId)} variant="secondary" pendingLabel="Saving…">
      Use this
    </ActionButton>
  );
}
