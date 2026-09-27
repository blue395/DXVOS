"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { LINEAR_STAGES, PASSED_STAGE, type StageMeta } from "@/lib/pipeline";
import { WarningIcon } from "@/components/ui";
import { moveVenture } from "./actions";
import { PassDialog } from "./pass-dialog";

export type BoardCard = {
  id: string;
  name: string;
  sector: string | null;
  currentStage: Stage;
  daysInStage: number;
  warnings: string[];
  commsOwed: number;
};

export function KanbanBoard({ initialCards }: { initialCards: BoardCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [pendingPass, setPendingPass] = useState<BoardCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync when the server sends fresh data (after revalidation). This is React's
  // recommended "adjust state when a prop changes" pattern, without an effect.
  const [prevInitial, setPrevInitial] = useState(initialCards);
  if (initialCards !== prevInitial) {
    setPrevInitial(initialCards);
    setCards(initialCards);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function move(card: BoardCard, to: Stage, passReason?: PassReason, note?: string) {
    const before = cards;
    setError(null);
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, currentStage: to, daysInStage: 0 } : c)));
    startTransition(async () => {
      const res = await moveVenture(card.id, { to, passReason, note });
      if (res.error) {
        setCards(before);
        setError(`${card.name}: ${res.error}`);
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (!card || !to || to === card.currentStage) return;
    if (to === "PASSED") setPendingPass(card);
    else move(card, to);
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {/* The ten linear stages scroll horizontally; Passed is pinned to the right edge
            because it's reachable from every stage and must always be a visible drop target. */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LINEAR_STAGES.map((stage) => (
            <Column key={stage.key} stage={stage} cards={cards.filter((c) => c.currentStage === stage.key)} />
          ))}
          <div className="sticky right-0 shrink-0 bg-white pl-3 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.25)]">
            <Column stage={PASSED_STAGE} cards={cards.filter((c) => c.currentStage === "PASSED")} />
          </div>
        </div>
      </DndContext>
      {pendingPass && (
        <PassDialog
          ventureName={pendingPass.name}
          onCancel={() => setPendingPass(null)}
          onConfirm={(reason, note) => {
            move(pendingPass, "PASSED", reason, note);
            setPendingPass(null);
          }}
        />
      )}
    </>
  );
}

function Column({ stage, cards }: { stage: StageMeta; cards: BoardCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const passed = stage.key === "PASSED";

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-56 shrink-0 flex-col rounded-lg border ${
        isOver ? "border-dxv-green bg-dxv-yellow/30" : passed ? "border-black/15 bg-black/[0.03]" : "border-black/10 bg-dxv-green/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-black/10 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold leading-tight text-dxv-green">{stage.label}</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-black/45">
            {stage.intake ? "Intake" : passed ? "Declined" : ""}
            {stage.gate && !passed ? `${stage.intake ? " · " : ""}Decision gate` : ""}
          </p>
        </div>
        <span className="rounded-full bg-dxv-green px-2 py-0.5 text-xs font-medium text-white">{cards.length}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {cards.map((c) => (
          <DealCard key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function DealCard({ card }: { card: BoardCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-black/10 bg-white p-2.5 shadow-sm ${isDragging ? "z-10 shadow-lg ring-2 ring-dxv-green" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/deals/${card.id}`} className="font-medium leading-snug text-black hover:text-dxv-green hover:underline">
          {card.name}
        </Link>
        {card.warnings.length > 0 && <WarningIcon title={card.warnings.join(" · ")} />}
      </div>
      {card.sector && <p className="mt-0.5 text-xs text-black/55">{card.sector}</p>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-black/50">
        <span>
          {card.daysInStage} day{card.daysInStage === 1 ? "" : "s"} in stage
        </span>
        {card.commsOwed > 0 && (
          <span className="rounded bg-dxv-yellow px-1.5 py-0.5 font-medium text-dxv-green" title="Founder is owed a decision update">
            Update owed
          </span>
        )}
      </div>
    </div>
  );
}
