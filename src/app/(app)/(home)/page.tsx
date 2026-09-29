import Link from "next/link";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { dealsByStage, GATE_LABELS, daysSince, dashboardMetrics, formatGbp, formatGbpCompact } from "@/lib/pipeline";
import { Card, formatDate } from "@/components/ui";
import { loadAngelRows } from "@/lib/angels";

// Admin-only (spec: angels must never see the Dashboard or Activity, even once they
// can log in). requireAdmin() below enforces that; don't loosen it for angel roles.
export default async function DashboardPage() {
  const now = new Date();

  const [ventures, awaiting, angels] = await requireAdminWith(() =>
    Promise.all([
      db.venture.findMany({
        select: {
          currentStage: true,
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
    ]),
  );
  const members = angels.filter((a) => a.status === "MEMBER").length;
  const certNeeded = angels.filter((a) => a.needsAction).length;

  const byStage = dealsByStage(ventures.map((v) => v.currentStage));
  const maxCount = Math.max(1, ...byStage.map((s) => s.count));
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Angels"
          value={members}
          href={certNeeded ? "/angels?filter=action" : "/angels"}
          note={certNeeded ? `${certNeeded} need certification` : "Members, all certified"}
          alarm={certNeeded > 0}
        />
        <Metric label="Live Deals" value={metrics.liveDeals} href="/deals" />
        <Metric label="In DD" value={metrics.inDueDiligence} href="/deals" />
        <Metric label="Investments" value={metrics.investments} />
        <Metric
          wide
          label="Investment total"
          value={formatGbpCompact(metrics.investedTotalGbp)}
          title={`${formatGbp(metrics.investedTotalGbp)}: paid Final investment tickets on deals at Investment Complete or S/EIS`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Deals by stage">
          <ul className="space-y-1.5">
            {byStage.map((s) => (
              <li key={s.key}>
                <Link href="/deals" className="grid grid-cols-[170px_1fr_2rem] items-center gap-3 rounded text-sm hover:bg-dxv-green/5" title={`${s.label}: ${s.count}`}>
                  <span className="truncate text-black/75">{s.label}</span>
                  <span className="h-3.5">
                    {s.count > 0 && (
                      <span
                        className={`block h-full rounded-r ${s.key === "PASSED" ? "bg-black/60" : "bg-dxv-green"}`}
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    )}
                  </span>
                  <span className="text-right tabular-nums">{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
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

/** Large, centred headline number. */
function Metric({
  label,
  value,
  note,
  href,
  title,
  wide,
  alarm,
}: {
  label: string;
  value: number | string;
  note?: string;
  href?: string;
  title?: string;
  /** Full width on phones (the fifth tile would otherwise sit alone at half width). */
  wide?: boolean;
  /** Needs attention (the note becomes a yellow flag). */
  alarm?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm font-medium uppercase tracking-wide text-black/55">{label}</p>
      <p className="mt-2 text-4xl font-semibold text-dxv-green tabular-nums sm:text-5xl" title={title}>
        {value}
      </p>
      {/* Same height on every tile, so the numbers line up across the row. */}
      <p className={`mt-2 h-4 text-xs ${alarm ? "" : "text-black/45"}`}>
        {alarm ? <span className="rounded-full bg-dxv-yellow px-2 py-0.5 font-semibold text-black ring-1 ring-black/20">! {note}</span> : note}
      </p>
    </>
  );
  const cls = `flex flex-col items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-7 text-center ${
    wide ? "col-span-2 md:col-span-1" : ""
  }`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-dxv-green/40 hover:bg-dxv-green/[0.03]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
