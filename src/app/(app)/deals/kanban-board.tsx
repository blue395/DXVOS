"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";

// Drop onto whatever is under the pointer (so the small Declined pill is easy to hit);
// keyboard dragging has no pointer, so it falls back to overlap.
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

// The floating preview sits just below-right of the pointer, so it never hides the drop target.
const besidePointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent || !("clientX" in activatorEvent)) return transform;
  const e = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + e.clientX - draggingNodeRect.left + 14,
    y: transform.y + e.clientY - draggingNodeRect.top + 14,
  };
};
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { BOARD_STAGES, boardColumn, declinedColumn, formatGbpCompact, stageLabel, stagePhase, type DeckCardState, type StageMeta, type StagePhase } from "@/lib/pipeline";
import { Spinner, WarningIcon } from "@/components/ui";
import { moveVenture } from "./actions";
import { PassDialog } from "./pass-dialog";
import { DeckIntake } from "./deck-intake";
import { actionErrorMessage } from "@/lib/stale-version";

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
  /** "Reading deck…" while a dropped deck is read; "Not screened" at Submitted until an eligibility screen runs. */
  deckState: DeckCardState;
  leadAngel: string | null;
  /** Declined deals only: the stage it was declined at, and why. */
  declinedAt: Stage | null;
  declineReason: string | null;
};

// "live": the pipeline, drag to move. "declined": read-only, grouped by where each deal was declined.
export type BoardView = "live" | "declined";

export function KanbanBoard({
  initialCards,
  view = "live",
  toolbar,
  intakeRound = null,
}: {
  initialCards: BoardCard[];
  view?: BoardView;
  /** Round given to decks dropped on the Submitted column (the round the board is filtered to). */
  intakeRound?: number | null;
  /** Filter bar, rendered inside the drag area so its Declined pill can take dropped cards. */
  toolbar?: React.ReactNode;
}) {
  const [cards, setCards] = useState(initialCards);
  const [pendingDecline, setPendingDecline] = useState<BoardCard | null>(null);
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<Set<string>>(new Set());

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
    setSaving((s) => new Set(s).add(card.id));
    startTransition(async () => {
      let res: { error?: string };
      try {
        res = await moveVenture(card.id, { to, passReason, note });
      } catch (e) {
        res = { error: actionErrorMessage(e) };
      }
      setSaving((s) => {
        const next = new Set(s);
        next.delete(card.id);
        return next;
      });
      if (res.error) {
        setCards(before);
        setError(`${card.name}: ${res.error}`);
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const card = cards.find((c) => c.id === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (view !== "live" || !card || !to || to === boardColumn(card.currentStage)) return; // (S/EIS deals sit in Investment Complete)
    if (to === "PASSED") setPendingDecline(card); // dropped on the Declined pill: ask for a reason first
    else move(card, to);
  }

  if (view === "declined") {
    // Read-only: columns are the stages deals were declined at (only those with deals).
    const other = cards.filter((c) => declinedColumn(c.declinedAt) === null);
    const columns = BOARD_STAGES.map((stage) => ({ stage, cards: cards.filter((c) => declinedColumn(c.declinedAt) === stage.key) })).filter(
      (col) => col.cards.length > 0,
    );
    if (cards.length === 0) {
      return (
        <DndContext id="deals-board-declined">
          <div className="space-y-4">
            {toolbar}
            <p className="rounded-lg border border-black/10 px-4 py-6 text-center text-sm text-black/55">No declined deals in this selection.</p>
          </div>
        </DndContext>
      );
    }
    return (
      <DndContext id="deals-board-declined">
        {toolbar && <div className="mb-4">{toolbar}</div>}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map(({ stage, cards: cs }) => (
            <Column key={stage.key} stage={stage} cards={cs} saving={saving} declined />
          ))}
          {other.length > 0 && (
            <Column stage={{ key: "PASSED", label: "Stage not recorded" }} cards={other} saving={saving} declined />
          )}
        </div>
      </DndContext>
    );
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
      <DndContext
        id="deals-board"
        sensors={sensors}
        collisionDetection={pointerFirst}
        onDragStart={(e) => setDragging(cards.find((c) => c.id === e.active.id) ?? null)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        {toolbar && <div className="mb-4">{toolbar}</div>}
        {/* The linear stages scroll horizontally. Declined deals have their own view (the
            Declined filter pill); drop a card on that pill, or use the deal page, to decline. */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_STAGES.map((stage) => (
            <Column
              key={stage.key}
              stage={stage}
              cards={cards.filter((c) => boardColumn(c.currentStage) === stage.key)}
              saving={saving}
              intake={stage.key === "SUBMITTED" ? { round: intakeRound } : undefined}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null} modifiers={[besidePointer]}>{dragging ? <DragPreview card={dragging} /> : null}</DragOverlay>
      </DndContext>
      {pendingDecline && (
        <PassDialog
          ventureName={pendingDecline.name}
          stageLabel={stageLabel(pendingDecline.currentStage)}
          onCancel={() => setPendingDecline(null)}
          onConfirm={(reason, note) => {
            move(pendingDecline, "PASSED", reason, note);
            setPendingDecline(null);
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
  passed: { column: "bg-black/[0.03] border-black/15", header: "border-black/10", dot: "bg-black/60", label: "Kept for learning" },
};

function Column({
  stage,
  cards,
  saving,
  declined = false,
  intake,
}: {
  stage: StageMeta;
  cards: BoardCard[];
  saving: Set<string>;
  declined?: boolean;
  /** Submitted column: founder decks can be dropped here to file new deals. */
  intake?: { round: number | null };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key, disabled: declined });
  const phase = PHASE_STYLE[declined ? "passed" : stagePhase(stage.key)];
  const totalRaise = cards.reduce((a, c) => a + (c.raiseAmountGbp ?? 0), 0);
  const header = (
    <div className={`border-b px-3 py-2.5 ${phase.header}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold leading-tight text-dxv-green">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${phase.dot}`} />
          {declined && stage.key !== "PASSED" ? `Declined at ${stage.label}` : stage.label}
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
        {!declined && stage.gate && stage.key !== "PASSED" ? " · Decision gate" : ""}
        {!declined && stage.optional ? " · If applicable" : ""}
      </p>
    </div>
  );
  const list = (
    <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
      {cards.map((c) => (
        <DealCard key={c.id} card={c} saving={saving.has(c.id)} draggable={!declined} />
      ))}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-64 shrink-0 flex-col rounded-xl border ${isOver ? "border-dxv-green bg-dxv-yellow/30" : phase.column}`}
    >
      {intake ? (
        <DeckIntake round={intake.round} header={header}>
          {list}
        </DeckIntake>
      ) : (
        <>
          {header}
          {list}
        </>
      )}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function DealCard({ card, saving = false, draggable = true }: { card: BoardCard; saving?: boolean; draggable?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: !draggable });

  // While dragging, the card stays put (faded) and a floating copy follows the pointer
  // (DragOverlay), so it's never clipped by the board's scroll area on its way to the Declined pill.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`relative ${draggable ? "cursor-grab active:cursor-grabbing" : ""} rounded-lg border border-black/10 bg-white p-3 shadow-sm transition hover:-translate-y-px hover:border-dxv-green/40 hover:shadow-md ${
        isDragging ? "opacity-40" : ""
      } ${saving ? "opacity-70" : ""}`}
    >
      <CardContent card={card} saving={saving} />
    </div>
  );
}

/** The floating copy of a card being dragged. */
function DragPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-60 rotate-2 cursor-grabbing opacity-95 rounded-lg border border-dxv-green bg-white p-3 shadow-2xl ring-2 ring-dxv-green">
      <CardContent card={card} saving={false} />
    </div>
  );
}

function CardContent({ card, saving }: { card: BoardCard; saving: boolean }) {
  const hasPills = card.deckState || card.companyStage || card.sector || card.round || card.currentStage === "SEIS_CERTIFICATE" || card.declineReason;
  return (
    <>
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
          {saving && <Spinner className="h-3 w-3 text-dxv-green" />}
        </span>
      </div>

      {card.oneLiner && <p className="mt-1 line-clamp-2 text-xs leading-snug text-black/60">{card.oneLiner}</p>}

      {hasPills && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.deckState === "reading" && (
            <Pill className="inline-flex items-center gap-1 bg-dxv-green/10 text-dxv-green">
              <Spinner className="h-2.5 w-2.5" />
              Reading deck…
            </Pill>
          )}
          {card.deckState === "not-screened" && (
            <Pill className="bg-dxv-yellow/50 text-dxv-green ring-1 ring-dxv-yellow">
              <span title="Deck stored; the eligibility screen hasn't been run yet">Not screened</span>
            </Pill>
          )}
          {card.companyStage && <Pill className="bg-white text-black/75 ring-1 ring-black/15">{card.companyStage}</Pill>}
          {card.sector && <Pill className="bg-dxv-green/10 text-dxv-green">{card.sector}</Pill>}
          {card.round && <Pill className="bg-dxv-yellow text-dxv-green">Round {card.round}</Pill>}
          {card.currentStage === "SEIS_CERTIFICATE" && <Pill className="bg-dxv-green text-white">S/EIS</Pill>}
          {card.declineReason && <Pill className="bg-black text-white">{card.declineReason}</Pill>}
        </div>
      )}

      {/* Wraps inside the card: whole chunks move to the next line, never past the edge. */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-black/5 pt-2 text-[11px] text-black/50">
        <span className="min-w-0" title="Days since the deck was first uploaded for the eligibility check">
          <span className="whitespace-nowrap">{card.deckDaysAgo === null ? "No deck yet" : `Deck ${card.deckDaysAgo}d ago`}</span>
          <span className="text-black/30"> · </span>
          <span className="whitespace-nowrap">{card.daysInStage}d in stage</span>
          {card.leadAngel && (
            <>
              <span className="text-black/30"> · </span>
              <span className="whitespace-nowrap" title="Lead angel">
                Lead {card.leadAngel}
              </span>
            </>
          )}
        </span>
        {card.commsOwed > 0 && (
          <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-dxv-yellow px-1.5 py-0.5 font-medium text-dxv-green" title="Founder is owed a decision update">
            Update owed
          </span>
        )}
      </div>
    </>
  );
}
