"use client";

import { ActionButton } from "@/components/action-button";
import { archiveHolding } from "./actions";

export function RemoveHoldingButton({ holdingId, company }: { holdingId: string; company: string }) {
  return (
    <ActionButton
      run={() => archiveHolding(holdingId)}
      variant="secondary"
      pendingLabel="Removing…"
      confirm={`Remove ${company} from your portfolio?`}
    >
      Remove from portfolio
    </ActionButton>
  );
}
