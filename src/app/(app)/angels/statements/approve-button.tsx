"use client";

import { ActionButton } from "@/components/action-button";
import { approveComplianceText } from "./actions";

export function ApproveTextButton({ id, version }: { id: string; version: number }) {
  return (
    <ActionButton
      run={() => approveComplianceText(id)}
      pendingLabel="Approving…"
      confirm={`Approve version ${version}? From now on angels will see and sign this wording.`}
    >
      Approve version {version}
    </ActionButton>
  );
}
