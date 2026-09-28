"use client";

import { ActionButton } from "@/components/action-button";
import type { Stage } from "@/generated/prisma/enums";
import { moveVenture } from "../actions";

export type NavItem = { id: string; label: string; now: boolean; hint?: string };

/** Sticky jump menu for the deal page. Jumping to a collapsed section opens it. */
export function SectionNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Deal sections"
      className="sticky top-0 z-30 -mx-4 flex gap-1.5 overflow-x-auto border-b border-black/10 bg-white/95 px-4 py-2 backdrop-blur"
    >
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          onClick={() => {
            const el = document.getElementById(it.id);
            if (el instanceof HTMLDetailsElement) el.open = true;
          }}
          title={it.hint}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition hover:-translate-y-px ${
            it.now
              ? "border-dxv-yellow bg-dxv-yellow text-dxv-green hover:shadow-sm"
              : "border-dxv-green/20 text-dxv-green hover:border-dxv-green hover:bg-dxv-green/5"
          }`}
        >
          {it.label}
          {it.hint && <span className="ml-1.5 font-normal opacity-70">{it.hint}</span>}
        </a>
      ))}
    </nav>
  );
}

/** One click to the next stage. The confirm says what gets recorded for the founder. */
export function AdvanceButton({ ventureId, to, label, confirm }: { ventureId: string; to: Stage; label: string; confirm: string }) {
  return (
    <ActionButton run={() => moveVenture(ventureId, { to })} confirm={confirm} pendingLabel="Moving…">
      Advance to {label} →
    </ActionButton>
  );
}
