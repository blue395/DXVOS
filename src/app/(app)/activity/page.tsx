import Link from "next/link";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { PASS_REASON_LABELS, stageLabel } from "@/lib/pipeline";
import { Card, formatDateTime } from "@/components/ui";

// Spec §4: for the MVP the raw stage-history log is the activity feed.
// Admin-only (spec: angels must never see Activity or the Dashboard, even once they
// can log in). requireAdmin() below enforces that; don't loosen it for angel roles.
export default async function ActivityPage() {
  const changes = await requireAdminWith(() =>
    db.stageChange.findMany({
      orderBy: { changedAt: "desc" },
      take: 200,
      include: { venture: { select: { id: true, name: true } }, changedBy: { select: { name: true } } },
    }),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-dxv-green">Activity</h1>
      <Card title="Stage history (latest 200)">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-black/50">
            <tr>
              <th className="py-1.5 font-medium">When</th>
              <th className="py-1.5 font-medium">Venture</th>
              <th className="py-1.5 font-medium">Change</th>
              <th className="py-1.5 font-medium">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {changes.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5 whitespace-nowrap text-black/60">{formatDateTime(c.changedAt)}</td>
                <td className="py-1.5">
                  <Link href={`/deals/${c.venture.id}`} className="text-dxv-green hover:underline">
                    {c.venture.name}
                  </Link>
                </td>
                <td className="py-1.5">
                  {c.fromStage ? `${stageLabel(c.fromStage)} → ` : "Created at "}
                  <strong>{stageLabel(c.toStage)}</strong>
                  {c.passReason && <span className="text-black/60"> ({PASS_REASON_LABELS[c.passReason]})</span>}
                  {c.note && <span className="text-black/60"> · “{c.note}”</span>}
                </td>
                <td className="py-1.5 text-black/60">{c.changedBy?.name ?? "System"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
