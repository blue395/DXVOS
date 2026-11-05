"use client";

import { ActionButton } from "@/components/action-button";
import { sendDigestNow } from "./actions";

export function SendDigestButton() {
  return (
    <ActionButton variant="secondary" pendingLabel="Sending…" run={sendDigestNow}>
      Send the digest now
    </ActionButton>
  );
}
