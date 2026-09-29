import Link from "next/link";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  boardHref,
  cardOneLiner,
  daysSince,
  deckCardState,
  dealWarnings,
  PASS_REASON_LABELS,
  parseDeclinedFilter,
  parseRoundFilter,
  type RoundFilter,
} from "@/lib/pipeline";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { buttonClass } from "@/components/ui";
import { KanbanBoard, type BoardCard } from "../kanban-board";
import { DeclinedPill } from "../declined-pill";

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  const params = await searchParams;
  const filter = parseRoundFilter(params.round);
  const declined = parseDeclinedFilter(params.declined);

  // The live pipeline and the declined deals are separate views; the round filter applies to both.
  const stageWhere = declined ? { currentStage: "PASSED" as const } : { currentStage: { not: "PASSED" as const } };
  const roundWhere = filter.kind === "round" ? { round: filter.round } : filter.kind === "none" ? { round: null } : {};

  const [roundCounts, declinedCount, ventures] = await requireAdminWith(() =>
    Promise.all([
      // Counts per round for the filter pills, in the current view (null = no round assigned).
      db.venture.groupBy({ by: ["round"], where: stageWhere, _count: { _all: true }, orderBy: { round: "asc" } }),
      // How many declined deals in the selected round (for the Declined pill).
      db.venture.count({ where: { currentStage: "PASSED", ...roundWhere } }),
      db.venture.findMany({
        where: { ...stageWhere, ...roundWhere },
        orderBy: { stageEnteredAt: "asc" }, // longest-waiting first within each column
        select: {
          id: true,
          name: true,
          sector: true,
          round: true,
          companyStage: true,
          raiseAmountGbp: true,
          description: true,
          leadAngel: true,
          passReason: true,
          passedFromStage: true,
          currentStage: true,
          stageEnteredAt: true,
          ddItems: { select: { dueDate: true, completedAt: true } },
          _count: { select: { founderComms: { where: { status: "NOT_YET_SENT" } } } },
        },
      }),
    ]),
  );

  // Per deal: when the deck was first uploaded (the "submitted" clock starts at the
  // upload for the eligibility check), and the latest AI one-line summary.
  const ids = ventures.map((v) => v.id);
  // Also each deal's latest deck job, for the "Reading deck…" / "Not screened" pills.
  const [firstUploads, screens, latestJobs] = await Promise.all([
    db.deckAnalysis.groupBy({ by: ["ventureId"], where: { ventureId: { in: ids } }, _min: { createdAt: true } }),
    db.deckAnalysis.findMany({
      where: { ventureId: { in: ids }, status: "COMPLETE", intakeOnly: false },
      orderBy: { completedAt: "desc" },
      distinct: ["ventureId"],
      select: { ventureId: true, screen: true },
    }),
    db.deckAnalysis.findMany({
      where: { ventureId: { in: ids } },
      orderBy: { createdAt: "desc" },
      distinct: ["ventureId"],
      select: { ventureId: true, status: true, error: true, createdAt: true, startedAt: true, intakeOnly: true },
    }),
  ]);
  const deckSince = new Map(firstUploads.map((u) => [u.ventureId, u._min.createdAt]));
  const aiSummary = new Map(screens.map((a) => [a.ventureId, (a.screen as EligibilityScreen | null)?.oneLineSummary]));
  const latestJob = new Map(latestJobs.map((a) => [a.ventureId, { status: effectiveDeckStatus(a).status, intakeOnly: a.intakeOnly }]));

  const now = new Date();
  // Shape exactly what the client needs — nothing more crosses to the browser.
  const cards: BoardCard[] = ventures.map((v) => ({
    id: v.id,
    name: v.name,
    sector: v.sector,
    round: v.round,
    companyStage: v.companyStage,
    raiseAmountGbp: v.raiseAmountGbp,
    oneLiner: cardOneLiner(aiSummary.get(v.id), v.description),
    deckDaysAgo: deckSince.get(v.id) ? daysSince(deckSince.get(v.id)!, now) : null,
    currentStage: v.currentStage,
    daysInStage: daysSince(v.stageEnteredAt, now),
    warnings: dealWarnings(v, now),
    commsOwed: v._count.founderComms,
    deckState: deckCardState(v.currentStage, latestJob.get(v.id), aiSummary.has(v.id)),
    leadAngel: v.leadAngel,
    declinedAt: v.passedFromStage,
    declineReason: v.passReason ? PASS_REASON_LABELS[v.passReason] : null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Deals</h1>
          <p className="text-sm text-black/60">
            {declined
              ? "Declined deals, grouped by where in the dealflow they were declined. Kept for dealflow learning; open a deal to reopen it."
              : "Drag a card to move it between stages, or onto the Declined pill to decline it. Every move is logged."}
          </p>
        </div>
        <Link href="/deals/new" className={buttonClass("accent")}>
          + New venture
        </Link>
      </div>
      {/* The filter bar goes inside the board so its Declined pill can take dropped cards. */}
      <KanbanBoard
        initialCards={cards}
        view={declined ? "declined" : "live"}
        intakeRound={filter.kind === "round" ? filter.round : null}
        toolbar={
          <RoundFilterBar
            filter={filter}
            declined={declined}
            declinedCount={declinedCount}
            counts={roundCounts.map((r) => ({ round: r.round, count: r._count._all }))}
          />
        }
      />
    </div>
  );
}

/**
 * Filter pills. Plain links, so a filtered board can be bookmarked or shared
 * (/deals?round=3&declined=1). Round pills keep the Declined toggle, and vice versa.
 */
function RoundFilterBar({
  filter,
  declined,
  declinedCount,
  counts,
}: {
  filter: RoundFilter;
  declined: boolean;
  declinedCount: number;
  counts: { round: number | null; count: number }[];
}) {
  const total = counts.reduce((a, c) => a + c.count, 0);
  const unassigned = counts.find((c) => c.round === null)?.count ?? 0;
  const pills = [
    { href: boardHref({ kind: "all" }, declined), label: "All rounds", count: total, active: filter.kind === "all" },
    ...counts
      .filter((c) => c.round !== null)
      .map((c) => ({
        href: boardHref({ kind: "round", round: c.round! }, declined),
        label: `Round ${c.round}`,
        count: c.count,
        active: filter.kind === "round" && filter.round === c.round,
      })),
    ...(unassigned > 0 ? [{ href: boardHref({ kind: "none" }, declined), label: "No round", count: unassigned, active: filter.kind === "none" }] : []),
  ];
  // A round asked for in the URL that has no deals still shows as selected.
  if (filter.kind === "round" && !counts.some((c) => c.round === filter.round)) {
    pills.push({ href: boardHref(filter, declined), label: `Round ${filter.round}`, count: 0, active: true });
  }

  return (
    <nav aria-label="Filter deals" className="flex flex-wrap items-center gap-2">
      {pills.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.active ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            p.active ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
          }`}
        >
          {p.label} <span className={p.active ? "text-dxv-yellow" : "text-black/45"}>{p.count}</span>
        </Link>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px bg-black/15" />
      {/* Toggle: combines with the round filter to show that round's declined deals.
          On the live board it's also where you drop a card to decline it. */}
      <DeclinedPill href={boardHref(filter, !declined)} active={declined} count={declinedCount} droppable={!declined} />
    </nav>
  );
}
