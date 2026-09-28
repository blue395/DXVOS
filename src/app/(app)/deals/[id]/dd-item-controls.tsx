"use client";

// DD checklist controls: the tick flips instantly (optimistic) while the server saves;
// removing asks first and shows that it's working.

import { useOptimistic, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { deleteDDItem, toggleDDItem } from "../actions";

export function DDItemToggle({ itemId, done }: { itemId: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={optimisticDone ? "Mark not done" : "Mark done"}
      aria-pressed={optimisticDone}
      onClick={() =>
        start(async () => {
          setOptimisticDone(!optimisticDone);
          await toggleDDItem(itemId);
        })
      }
      className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded border transition hover:ring-2 hover:ring-dxv-green/30 ${
        optimisticDone ? "border-dxv-green bg-dxv-green text-white" : "border-black/30 bg-white"
      } ${pending ? "opacity-70" : ""}`}
    >
      {optimisticDone ? "✓" : ""}
    </button>
  );
}

export function DDItemRemove({ itemId, title }: { itemId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Remove item"
      title="Remove this DD item"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Remove the DD item "${title}"? Attached files stay under Documents.`)) return;
        start(() => deleteDDItem(itemId));
      }}
      className="cursor-pointer rounded px-1.5 text-black/35 transition hover:bg-black/5 hover:text-black disabled:cursor-wait"
    >
      {pending ? <Spinner className="h-3 w-3" /> : "×"}
    </button>
  );
}
