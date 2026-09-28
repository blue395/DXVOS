"use client";

import { useState } from "react";
import type { PassReason } from "@/generated/prisma/enums";
import { PASS_REASONS, PASS_REASON_LABELS } from "@/lib/pipeline";
import { Field, buttonClass, inputClass } from "@/components/ui";

// Passing always requires a reason (spec §5), so dropping a card on "Passed" asks first.
export function PassDialog({
  ventureName,
  onCancel,
  onConfirm,
}: {
  ventureName: string;
  onCancel: () => void;
  onConfirm: (reason: PassReason, note: string) => void;
}) {
  const [reason, setReason] = useState<PassReason | "">("");
  const [note, setNote] = useState("");
  const needsNote = reason === "OTHER" && note.trim() === "";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason && !needsNote) onConfirm(reason, note);
        }}
      >
        <h2 className="text-lg font-semibold text-dxv-green">Decline {ventureName}?</h2>
        <p className="text-sm text-black/60">
          The deal moves to Declined (it isn&apos;t deleted), and a founder decision update will be flagged as owed.
        </p>
        <Field label="Reason">
          <select autoFocus required value={reason} onChange={(e) => setReason(e.target.value as PassReason)} className={inputClass}>
            <option value="">Choose a reason…</option>
            {PASS_REASONS.map((r) => (
              <option key={r} value={r}>
                {PASS_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={reason === "OTHER" ? "Note (required)" : "Note (optional)"}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={!reason || needsNote} className={buttonClass("primary")}>
            Decline deal
          </button>
        </div>
      </form>
    </div>
  );
}
