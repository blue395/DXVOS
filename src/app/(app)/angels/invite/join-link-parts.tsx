"use client";

// Buttons for shareable sign-up links and their join requests (Angels → Invite an angel).
import { ActionButton } from "@/components/action-button";
import { approveJoin, declineJoin, switchOffJoinLink } from "../join-actions";

export function JoinRequestButtons({ id, name }: { id: string; name: string }) {
  return (
    <span className="flex flex-wrap gap-2">
      <ActionButton pendingLabel="Approving…" run={() => approveJoin(id)} confirm={`Approve ${name}? They'll be emailed a personal sign-up link.`}>
        Approve
      </ActionButton>
      <ActionButton variant="secondary" pendingLabel="Declining…" run={() => declineJoin(id)} confirm={`Decline ${name}'s request? Nothing is sent to them.`}>
        Decline
      </ActionButton>
    </span>
  );
}

export function SwitchOffLinkButton({ id, label }: { id: string; label: string }) {
  return (
    <ActionButton
      variant="secondary"
      pendingLabel="Switching off…"
      run={() => switchOffJoinLink(id)}
      confirm={`Switch off "${label}"? Nobody new can ask to join through it.`}
    >
      Switch off
    </ActionButton>
  );
}
