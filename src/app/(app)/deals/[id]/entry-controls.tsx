"use client";

// Row controls for EOIs and final investments: Edit opens the form under the row
// (it closes itself after saving), Remove asks first. Both are logged server-side.

import { useOptimistic, useState, useTransition } from "react";
import { RevealContext } from "@/components/reveal";
import { Spinner } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { setFinalInvestmentPaid } from "../actions";

const linkButton =
  "cursor-pointer rounded px-1.5 py-0.5 text-xs text-dxv-green transition hover:bg-dxv-green/10 disabled:cursor-wait disabled:opacity-60";

export function EntryRow({
  children,
  editForm,
  remove,
  label,
}: {
  children: React.ReactNode;
  editForm: React.ReactNode;
  remove: () => Promise<ActionResult>;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className={`py-2 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
        <div className="min-w-0 flex-1">{children}</div>
        {!editing && (
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" className={linkButton} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${linkButton} text-black/50 hover:text-black`}
              onClick={() => {
                if (!window.confirm(`Remove ${label}? It's hidden from the list and totals; the change is kept in History.`)) return;
                start(async () => setError((await remove()).error ?? null));
              }}
            >
              {pending ? <Spinner className="h-3 w-3" /> : "Remove"}
            </button>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 rounded bg-dxv-yellow/30 px-2 py-0.5 text-xs">
          {error}
        </p>
      )}
      {editing && (
        <RevealContext.Provider value={{ close: () => setEditing(false) }}>
          <div className="mt-2 rounded-lg border border-dxv-green/20 bg-dxv-green/[0.03] p-3">{editForm}</div>
        </RevealContext.Provider>
      )}
    </li>
  );
}

/** Payment tick: flips instantly while the server saves. */
export function PaidToggle({ entryId, paid, angelName }: { entryId: string; paid: boolean; angelName: string }) {
  const [optimisticPaid, setOptimisticPaid] = useOptimistic(paid);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimisticPaid}
      aria-label={optimisticPaid ? `${angelName} paid: mark as not paid` : `Mark ${angelName} as paid`}
      title={optimisticPaid ? "Paid" : "Tick when the money has arrived"}
      onClick={() =>
        start(async () => {
          setOptimisticPaid(!optimisticPaid);
          await setFinalInvestmentPaid(entryId, !optimisticPaid);
        })
      }
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition hover:ring-2 hover:ring-dxv-green/30 ${
        optimisticPaid ? "border-dxv-green bg-dxv-green text-white" : "border-black/30 bg-white"
      } ${pending ? "opacity-70" : ""}`}
    >
      {optimisticPaid ? "✓" : ""}
    </button>
  );
}
