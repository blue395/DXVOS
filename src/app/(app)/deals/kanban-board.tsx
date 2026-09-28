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
import { formatGbpCompact, LINEAR_STAGES, PASSED_STAGE, stagePhase, type StageMeta, type StagePhase } from "@/lib/pipeline";
import { WarningIcon } from "@/components/ui";
import { moveVenture } from "./actions";
import { PassDialog } from "./pass-dialog";

export type BoardCard = {
  id: string;
  name: string;
  sector: string | null;
  round: number | null;
  companyStage: string | null;
  raiseAmountGbp: number | null;
  oneLiner: string | null;
  /** Days since the deck was first uploaded; null if no deck yet. */
  deckDaysAgo: number | null;
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
      {/* Fixed id: dnd-kit otherwise numbers its accessibility ids with a counter that
          differs between server and browser rendering (a hydration mismatch). */}
      <DndContext id="deals-board" sensors={sensors} onDragEnd={onDragEnd}>
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

// Brand-only colours: phases are told apart by tints of DXV green/yellow (and black
// for Passed), never by extra hues.
const PHASE_STYLE: Record<StagePhase, { column: string; header: string; dot: string; label: string }> = {
  intake: { column: "bg-dxv-yellow/10 border-dxv-yellow/40", header: "border-dxv-yellow/40", dot: "bg-dxv-yellow ring-1 ring-dxv-green/30", label: "Intake" },
  review: { column: "bg-dxv-green/[0.03] border-dxv-green/15", header: "border-dxv-green/15", dot: "bg-dxv-green/40", label: "Review & pitch" },
  closing: { column: "bg-dxv-green/[0.07] border-dxv-green/20", header: "border-dxv-green/20", dot: "bg-dxv-green/70", label: "Closing" },
  invested: { column: "bg-dxv-green/[0.12] border-dxv-green/30", header: "border-dxv-green/30", dot: "bg-dxv-green", label: "Invested" },
  passed: { column: "bg-black/[0.03] border-black/15", header: "border-black/10", dot: "bg-black/60", label: "Declined" },
};

function Column({ stage, cards }: { stage: StageMeta; cards: BoardCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const phase = PHASE_STYLE[stagePhase(stage.key)];
  const totalRaise = cards.reduce((a, c) => a + (c.raiseAmountGbp ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-64 shrink-0 flex-col rounded-xl border ${isOver ? "border-dxv-green bg-dxv-yellow/30" : phase.column}`}
    >
      <div className={`border-b px-3 py-2.5 ${phase.header}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold leading-tight text-dxv-green">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${phase.dot}`} />
            {stage.label}
            <span className="rounded-full bg-white px-1.5 text-xs font-medium text-dxv-green ring-1 ring-dxv-green/20">{cards.length}</span>
          </h3>
          {totalRaise > 0 && (
            <span className="font-mono text-xs text-black/55" title="Total raise of deals in this column">
              {formatGbpCompact(totalRaise)}
            </span>
          )}
        </div>
        <p className="mt-1 pl-[18px] text-[10px] uppercase tracking-wide text-black/45">
          {phase.label}
          {stage.gate && stage.key !== "PASSED" ? " · Decision gate" : ""}
          {stage.optional ? " · If applicable" : ""}
        </p>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {cards.map((c) => (
          <DealCard key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function DealCard({ card }: { card: BoardCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const hasPills = card.companyStage || card.sector || card.round;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-black/10 bg-white p-3 shadow-sm transition-shadow hover:shadow ${
        isDragging ? "z-10 shadow-lg ring-2 ring-dxv-green" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/deals/${card.id}`} className="font-semibold leading-snug text-black hover:text-dxv-green hover:underline">
          {card.name}
        </Link>
        <span className="flex shrink-0 items-center gap-1.5">
          {card.raiseAmountGbp ? (
            <span className="font-mono text-xs font-semibold text-dxv-green" title="Total raise">
              {formatGbpCompact(card.raiseAmountGbp)}
            </span>
          ) : null}
          {card.warnings.length > 0 && <WarningIcon title={card.warnings.join(" · ")} />}
        </span>
      </div>

      {card.oneLiner && <p className="mt-1 line-clamp-2 text-xs leading-snug text-black/60">{card.oneLiner}</p>}

      {hasPills && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.companyStage && <Pill className="bg-white text-black/75 ring-1 ring-black/15">{card.companyStage}</Pill>}
          {card.sector && <Pill className="bg-dxv-green/10 text-dxv-green">{card.sector}</Pill>}
          {card.round && <Pill className="bg-dxv-yellow text-dxv-green">Round {card.round}</Pill>}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-black/5 pt-2 text-[11px] text-black/50">
        <span className="whitespace-nowrap" title="Days since the deck was first uploaded for the eligibility check">
          {card.deckDaysAgo === null ? "No deck yet" : `Deck ${card.deckDaysAgo}d ago`}
          <span className="text-black/30"> · </span>
          {card.daysInStage}d in stage
        </span>
        {card.commsOwed > 0 && (
          <span className="whitespace-nowrap rounded-full bg-dxv-yellow px-1.5 py-0.5 font-medium text-dxv-green" title="Founder is owed a decision update">
            Update owed
          </span>
        )}
      </div>
    </div>
  );
}
