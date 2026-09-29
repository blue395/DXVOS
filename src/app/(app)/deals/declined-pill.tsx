"use client";

// The board's Declined filter pill. On the live board it's also a drop target:
// drag a deal card onto it to decline the deal (a reason is asked for first).

import Link from "next/link";
import { useDndContext, useDroppable } from "@dnd-kit/core";

export function DeclinedPill({ href, active, count, droppable }: { href: string; active: boolean; count: number; droppable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "PASSED", disabled: !droppable });
  const dragging = !!useDndContext().active && droppable;

  return (
    <Link
      ref={setNodeRef}
      href={href}
      aria-pressed={active}
      title={active ? "Back to the live pipeline" : "Show declined deals (in the selected round). Drag a card here to decline it."}
      className={`rounded-full border px-3 py-1 text-sm transition ${
        isOver
          ? "scale-110 border-black bg-black text-white ring-4 ring-dxv-yellow"
          : dragging
            ? "animate-pulse border-2 border-dashed border-black bg-dxv-yellow/40 text-black"
            : active
              ? "border-black bg-black text-white"
              : "border-black/40 text-black hover:bg-black/5"
      }`}
    >
      {active && <span aria-hidden>✓ </span>}
      {dragging ? (isOver ? "Drop to decline" : "Declined: drop here to decline") : "Declined"}{" "}
      {!dragging && <span className={active ? "text-dxv-yellow" : "text-black/45"}>{count}</span>}
    </Link>
  );
}
