"use client";

// Choosing your own angel record (or creating one) to switch on your member view.

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { setUpMyMemberAccess } from "./actions";

export function ThatsMeButton({ angelId, label }: { angelId: string | null; label: string }) {
  return (
    <ActionButton run={() => setUpMyMemberAccess(angelId)} pendingLabel="Setting up…">
      {label}
    </ActionButton>
  );
}

export function ChooseRecord({ options }: { options: { id: string; label: string }[] }) {
  const [id, setId] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Your angel record" className="rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm">
        <option value="">Choose your record…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {id && (
        <ActionButton run={() => setUpMyMemberAccess(id)} variant="secondary" pendingLabel="Setting up…">
          This is me
        </ActionButton>
      )}
    </div>
  );
}
