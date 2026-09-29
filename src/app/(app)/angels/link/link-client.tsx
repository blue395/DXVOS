"use client";

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { inputClass } from "@/components/ui";
import { confirmAngelAlias, confirmAngelAliases } from "../actions";

type Item = { typed: string; uses: number; suggestion: string | null };

export function LinkNames({ items, angels }: { items: Item[]; angels: { id: string; name: string }[] }) {
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.typed, i.suggestion ?? ""])));
  const suggested = items.filter((i) => i.suggestion && choice[i.typed] === i.suggestion);
  return (
    <div className="space-y-3">
      {suggested.length > 1 && (
        <ActionButton run={() => confirmAngelAliases(suggested.map((i) => ({ typedName: i.typed, angelId: i.suggestion! })))} pendingLabel="Linking…">
          Link all {suggested.length} suggested matches
        </ActionButton>
      )}
      <ul className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
        {items.map((i) => (
          <li key={i.typed} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span>
              <strong>&ldquo;{i.typed}&rdquo;</strong>
              <span className="block text-xs text-black/50">
                on {i.uses} vote{i.uses === 1 ? "" : "s"} or investment{i.uses === 1 ? "" : "s"}
                {i.suggestion && choice[i.typed] === i.suggestion && " · suggested match"}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`Angel for ${i.typed}`}
                value={choice[i.typed]}
                onChange={(e) => setChoice((c) => ({ ...c, [i.typed]: e.target.value }))}
                className={`${inputClass} w-56`}
              >
                <option value="">Choose an angel…</option>
                {angels.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ActionButton
                run={async () => (choice[i.typed] ? confirmAngelAlias(i.typed, choice[i.typed]) : { error: "Choose an angel." })}
                variant="secondary"
                pendingLabel="Linking…"
              >
                Link
              </ActionButton>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
