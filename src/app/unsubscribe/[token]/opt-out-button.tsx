"use client";

import { ActionButton } from "@/components/action-button";
import { setMyEmailOptOut } from "./actions";

export function OptOutButton({ token, optOut, label }: { token: string; optOut: boolean; label: string }) {
  return (
    <ActionButton variant={optOut ? "primary" : "secondary"} pendingLabel="Saving…" run={() => setMyEmailOptOut(token, optOut)}>
      {label}
    </ActionButton>
  );
}
