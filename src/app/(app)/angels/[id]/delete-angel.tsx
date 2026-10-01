"use client";

// "Delete angel": what will happen for this record, and a typed-name confirmation.

import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { deleteAngel } from "../actions";

export function DeleteAngelForm({ angelId, name, mode }: { angelId: string; name: string; mode: "remove" | "erase" }) {
  return (
    <div className="space-y-3 text-sm">
      {mode === "remove" ? (
        <p>
          This record has no votes, investments, statements or login, so it will be <strong>removed completely</strong>. Use this for duplicates and
          mistakes.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p>
            {name} has history with DXV, so their <strong>personal details will be erased</strong> and the record kept:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-black/75">
            <li>Name, email, phone, LinkedIn, location, bio, sectors, tags and notes are removed.</li>
            <li>Their login (and any connected Google account) is closed; their private portfolio is removed.</li>
            <li>Votes and investments stay in deal totals, shown as &ldquo;Deleted angel&rdquo;.</li>
            <li>Signed investor statements are kept as evidence (type, dates, wording version) without their name, signature, IP or file.</li>
          </ul>
        </div>
      )}
      <p className="rounded bg-dxv-yellow/30 px-2 py-1">This can&apos;t be undone.</p>
      <ActionForm action={deleteAngel.bind(null, angelId)} resetOnSuccess={false} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-56 flex-1 space-y-1">
          <span className="text-xs font-medium text-black/70">
            Type <strong>{name}</strong> to confirm
          </span>
          <input name="confirm" autoComplete="off" required className={inputClass} />
        </label>
        <SubmitButton variant="secondary" pendingLabel={mode === "remove" ? "Removing…" : "Erasing…"} doneLabel="Done">
          {mode === "remove" ? "Remove this record" : "Erase their personal details"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
