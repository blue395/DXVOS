import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_STAGES, GATE_LABELS, daysSince, dealWarnings } from "@/lib/pipeline";
import { Card, formatDate } from "@/components/ui";

export default async function DashboardPage() {
  await requireAdmin();
  const now = new Date();

  const [ventures, awaiting] = await Promise.all([
    db.venture.findMany({
      select: {
        currentStage: true,
        stageEnteredAt: true,
        ddItems: { select: { dueDate: true, completedAt: true } },
      },
    }),
    // Spec §6: ventures at a crossed gate whose founder comm isn't marked Sent yet.
    db.founderComm.findMany({
      where: { status: "NOT_YET_SENT" },
      orderBy: { createdAt: "asc" },
      include: { venture: { select: { id: true, name: true } } },
    }),
  ]);

  const byStage = ALL_STAGES.map((s) => ({ ...s, count: ventures.filter((v) => v.currentStage === s.key).length }));
  const maxCount = Math.max(1, ...byStage.map((s) => s.count));
  const active = ventures.filter((v) => v.currentStage !== "PASSED" && v.currentStage !== "INVESTMENT").length;
  const flagged = ventures.filter((v) => dealWarnings(v, now).length > 0).length;
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="#awaiting" className="rounded-lg bg-dxv-green p-5 text-white hover:bg-dxv-green/95">
          <p className="text-sm text-white/80">Founders awaiting a decision update</p>
          <p className="mt-1 text-4xl font-semibold text-dxv-yellow tabular-nums">{foundersAwaiting}</p>
        </Link>
        <Stat label="Active deals" value={active} />
        <Stat label="Deals with warnings" value={flagged} />
        <Stat label="Passed" value={byStage.find((s) => s.key === "PASSED")!.count} />
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
          <Card title="Founders awaiting a decision update">
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

      <p className="text-xs text-black/45">Certification-overdue count and upcoming pitch event arrive with the Angels module (week 2).</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5">
      <p className="text-sm text-black/60">{label}</p>
      <p className="mt-1 text-4xl font-semibold text-dxv-green tabular-nums">{value}</p>
    </div>
  );
}
