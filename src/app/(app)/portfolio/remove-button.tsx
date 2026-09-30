"use client";

import { ActionButton } from "@/components/action-button";
import { archiveSyndicateHolding } from "./actions";

export function RemoveSyndicateButton({ holdingId, company }: { holdingId: string; company: string }) {
  return (
    <ActionButton
      run={() => archiveSyndicateHolding(holdingId)}
      variant="secondary"
      pendingLabel="Removing…"
      confirm={`Remove ${company} from the syndicate portfolio? It's kept on record, just hidden.`}
    >
      Remove from portfolio
    </ActionButton>
  );
}
