import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cardOneLiner, daysSince, dealWarnings, parseRoundFilter, type RoundFilter } from "@/lib/pipeline";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { buttonClass } from "@/components/ui";
import { KanbanBoard, type BoardCard } from "./kanban-board";

export default async function DealsPage({ searchParams }: PageProps<"/deals">) {
  await requireAdmin();
  const filter = parseRoundFilter((await searchParams).round);

  // Counts per round for the filter pills (null = no round assigned).
  const roundCounts = await db.venture.groupBy({ by: ["round"], _count: { _all: true }, orderBy: { round: "asc" } });

  const ventures = await db.venture.findMany({
    where: filter.kind === "round" ? { round: filter.round } : filter.kind === "none" ? { round: null } : {},
    orderBy: { stageEnteredAt: "asc" }, // longest-waiting first within each column
    select: {
      id: true,
      name: true,
      sector: true,
      round: true,
      companyStage: true,
      raiseAmountGbp: true,
      description: true,
      currentStage: true,
      stageEnteredAt: true,
      ddItems: { select: { dueDate: true, completedAt: true } },
      _count: { select: { founderComms: { where: { status: "NOT_YET_SENT" } } } },
    },
  });

  // Per deal: when the deck was first uploaded (the "submitted" clock starts at the
  // upload for the eligibility check), and the latest AI one-line summary.
  const ids = ventures.map((v) => v.id);
  const [firstUploads, screens] = await Promise.all([
    db.deckAnalysis.groupBy({ by: ["ventureId"], where: { ventureId: { in: ids } }, _min: { createdAt: true } }),
    db.deckAnalysis.findMany({
      where: { ventureId: { in: ids }, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
      distinct: ["ventureId"],
      select: { ventureId: true, screen: true },
    }),
  ]);
  const deckSince = new Map(firstUploads.map((u) => [u.ventureId, u._min.createdAt]));
  const aiSummary = new Map(screens.map((a) => [a.ventureId, (a.screen as EligibilityScreen | null)?.oneLineSummary]));

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
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Deals</h1>
          <p className="text-sm text-black/60">Drag a card to move it between stages. Every move is logged.</p>
        </div>
        <Link href="/deals/new" className={buttonClass("accent")}>
          + New venture
        </Link>
      </div>
      <RoundFilterBar filter={filter} counts={roundCounts.map((r) => ({ round: r.round, count: r._count._all }))} />
      <KanbanBoard initialCards={cards} />
    </div>
  );
}

/** Filter pills. Plain links, so a filtered board can be bookmarked or shared (/deals?round=3). */
function RoundFilterBar({ filter, counts }: { filter: RoundFilter; counts: { round: number | null; count: number }[] }) {
  const total = counts.reduce((a, c) => a + c.count, 0);
  const unassigned = counts.find((c) => c.round === null)?.count ?? 0;
  const pills = [
    { href: "/deals", label: "All rounds", count: total, active: filter.kind === "all" },
    ...counts
      .filter((c) => c.round !== null)
      .map((c) => ({
        href: `/deals?round=${c.round}`,
        label: `Round ${c.round}`,
        count: c.count,
        active: filter.kind === "round" && filter.round === c.round,
      })),
    ...(unassigned > 0 ? [{ href: "/deals?round=none", label: "No round", count: unassigned, active: filter.kind === "none" }] : []),
  ];
  // A round asked for in the URL that has no deals still shows as selected.
  if (filter.kind === "round" && !counts.some((c) => c.round === filter.round)) {
    pills.push({ href: `/deals?round=${filter.round}`, label: `Round ${filter.round}`, count: 0, active: true });
  }

  return (
    <nav aria-label="Filter by round" className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.active ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-sm ${
            p.active ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
          }`}
        >
          {p.label} <span className={p.active ? "text-dxv-yellow" : "text-black/45"}>{p.count}</span>
        </Link>
      ))}
    </nav>
  );
}
