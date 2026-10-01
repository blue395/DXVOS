import Link from "next/link";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { GATE_LABELS, daysSince, dashboardBands, dashboardMetrics, formatGbp, formatGbpCompact, memberBoardCards, stagePhase, type DashboardBand } from "@/lib/pipeline";
import { PHASE_STYLE } from "@/lib/board-style";
import { MemberRoundSelect } from "./member-round-select";
import { Card, formatDate } from "@/components/ui";
import { loadAngelRows } from "@/lib/angels";

// Admin-only (spec: angels must never see the Dashboard or Activity, even once they
// can log in). requireAdmin() below enforces that; don't loosen it for angel roles.
export default async function DashboardPage() {
  const now = new Date();

  const [ventures, awaiting, angels, memberRound] = await requireAdminWith(() =>
    Promise.all([
      db.venture.findMany({
        select: {
          currentStage: true,
          round: true,
          sharedWithAngelsAt: true,
          investedAmountGbp: true,
          finalInvestments: { where: { removedAt: null }, select: { ticketGbp: true, paidAt: true } },
        },
      }),
      // Spec §6: ventures at a crossed gate whose founder comm isn't marked Sent yet.
      db.founderComm.findMany({
        where: { status: "NOT_YET_SENT" },
        orderBy: { createdAt: "asc" },
        include: { venture: { select: { id: true, name: true } } },
      }),
      loadAngelRows(),
      db.memberRound.findFirst({ orderBy: { createdAt: "desc" }, include: { by: { select: { name: true } } } }),
    ]),
  );
  // The members' deals board: which round, and how much of it members can open.
  const offeredRound = memberRound?.round ?? null;
  const boardCards = memberBoardCards(ventures, offeredRound);
  const maxRound = Math.max(0, ...ventures.map((v) => v.round ?? 0));
  const roundOptions = Array.from({ length: maxRound + 1 }, (_, i) => i + 1);
  const members = angels.filter((a) => a.status === "MEMBER").length;
  const certNeeded = angels.filter((a) => a.needsAction).length;

  const bands = dashboardBands(ventures.map((v) => v.currentStage));
  const metrics = dashboardMetrics(ventures);
  // One row per founder/venture (that's what the headline counts), listing each gate owed.
  const awaitingByVenture = [...Map.groupBy(awaiting, (c) => c.venture.id).values()].map((comms) => ({
    venture: comms[0].venture,
    comms,
    oldest: comms[0].createdAt, // query is ordered oldest-first
  }));
  const foundersAwaiting = awaitingByVenture.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dxv-green">Dashboard</h1>

      {/* 1. What DXV has invested: the headline. */}
      <Link
        href="/portfolio"
        className="grid grid-cols-2 overflow-hidden rounded-xl bg-dxv-green text-white shadow-sm transition hover:shadow-md"
        title={`${formatGbp(metrics.investedTotalGbp)}: paid Final investment tickets on deals at Investment Complete or S/EIS`}
      >
        <HeroFigure label="Investments" value={metrics.investments} note={metrics.investments === 1 ? "company backed" : "companies backed"} />
        <HeroFigure label="Investment total" value={formatGbpCompact(metrics.investedTotalGbp)} note="paid tickets" divider />
      </Link>

      {/* 2-4. Where live deals are, in the order they move. */}
      <Band step={1} title="Pipeline" note="New deals being screened and reviewed by the partners" band={bands.pipeline} />
      <Band step={2} title="Syndicate decision" note="With members: pitch selection, investment votes and commitments" band={bands.syndicate} />
      <Band step={3} title="In DD" note="Due diligence before the final investment" band={bands.dd} />

      {/* 5. The people, and the deals kept for learning. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Angels"
          value={members}
          href={certNeeded ? "/angels?filter=action" : "/angels"}
          note={certNeeded ? `${certNeeded} need certification` : "Members, all certified"}
          alarm={certNeeded > 0}
        />
        <Metric label="Declined deals" value={bands.declined} href="/deals?declined=1" note="Kept for learning" muted />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Members' deals board">
          <div className="space-y-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Round open to members:</span>
              <MemberRoundSelect current={offeredRound} rounds={roundOptions} />
            </div>
            <p className="text-xs text-black/55">
              {offeredRound === null
                ? "Members see no deals board."
                : `Members see Round ${offeredRound}'s ${boardCards.length} live deal${boardCards.length === 1 ? "" : "s"} on a read-only board; ${boardCards.filter((c) => c.phase).length} open with details (shared, from Member Pitch Selection on).`}
              {memberRound && ` Set by ${memberRound.by.name}, ${formatDate(memberRound.createdAt)}.`}
            </p>
          </div>
        </Card>

        <div id="awaiting">
          <Card
            title="Founders awaiting a decision update"
            actions={<span className="rounded-full bg-dxv-yellow px-2.5 py-0.5 text-xs font-semibold text-dxv-green">{foundersAwaiting}</span>}
          >
            {awaitingByVenture.length === 0 ? (
              <p className="text-sm text-black/55">All founders are up to date.</p>
            ) : (
              <ul className="divide-y divide-black/10">
                {awaitingByVenture.map(({ venture, comms, oldest }) => (
                  <li key={venture.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div>
                      <Link href={`/deals/${venture.id}`} className="font-medium text-dxv-green hover:underline">
                        {venture.name}
                      </Link>
                      {comms.map((c) => (
                        <p key={c.id} className="text-xs text-black/60">
                          {GATE_LABELS[c.gate]} · {c.decision}
                        </p>
                      ))}
                    </div>
                    <span className="shrink-0 text-xs text-black/50" title={`Oldest owed since ${formatDate(oldest)}`}>
                      {daysSince(oldest, now)}d waiting
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

    </div>
  );
}

/** One figure in the green investments band. */
function HeroFigure({ label, value, note, divider }: { label: string; value: number | string; note: string; divider?: boolean }) {
  return (
    <div className={`px-5 py-6 sm:px-8 sm:py-8 ${divider ? "border-l border-white/15" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-dxv-yellow sm:text-6xl">{value}</p>
      <p className="mt-1 text-xs text-white/60">{note}</p>
    </div>
  );
}

/** A dealflow band: its total, then a tile per stage in the board's phase colours. */
function Band({ step, title, note, band }: { step: number; title: string; note: string; band: DashboardBand }) {
  const single = band.stages.length === 1;
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dxv-yellow text-sm font-bold text-dxv-green" aria-hidden>
            {step}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-dxv-green">{title}</h2>
            <p className="text-sm text-black/55">{note}</p>
          </div>
        </div>
        <Link href="/deals" className="text-right" title={`${band.total} deals in ${title}`}>
          <span className="block text-4xl font-semibold tabular-nums leading-none text-dxv-green">{band.total}</span>
          <span className="text-xs text-black/50">{band.total === 1 ? "deal" : "deals"}</span>
        </Link>
      </div>
      {!single && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {band.stages.map((s) => {
            const style = PHASE_STYLE[stagePhase(s.key)];
            return (
              <Link
                key={s.key}
                href="/deals"
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition hover:-translate-y-px hover:shadow-sm ${style.column}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-black/80">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                  {s.label}
                </span>
                <span className="text-xl font-semibold tabular-nums text-dxv-green">{s.count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A headline number tile (Angels, Declined deals). */
function Metric({
  label,
  value,
  note,
  href,
  alarm,
  muted,
}: {
  label: string;
  value: number | string;
  note?: string;
  href: string;
  /** Needs attention (the note becomes a yellow flag). */
  alarm?: boolean;
  /** Declined: shown in black tints, like the board's Declined view. */
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-5 transition hover:shadow-sm ${
        muted ? "border-black/10 bg-black/[0.03] hover:border-black/30" : "border-black/10 bg-white hover:border-dxv-green/40"
      }`}
    >
      <span>
        <span className="block text-xs font-semibold uppercase tracking-widest text-black/55">{label}</span>
        <span className="mt-1.5 block text-xs">
          {alarm ? <span className="rounded-full bg-dxv-yellow px-2 py-0.5 font-semibold text-black ring-1 ring-black/20">! {note}</span> : <span className="text-black/50">{note}</span>}
        </span>
      </span>
      <span className={`text-4xl font-semibold tabular-nums sm:text-5xl ${muted ? "text-black/70" : "text-dxv-green"}`}>{value}</span>
    </Link>
  );
}
