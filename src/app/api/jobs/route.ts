// Recent background AI jobs, for the floating job tray. Small and cheap: three
// indexed queries in parallel, only the fields the tray shows.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { JOB_WINDOW_MS, type Job } from "@/lib/jobs";
import { aiDraftName } from "@/lib/memo-ai/render";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Unauthorised" }, { status: 401 });

  const since = new Date(Date.now() - JOB_WINDOW_MS);
  const common = { createdAt: true, startedAt: true, status: true, error: true } as const;
  const [decks, memos, dds] = await Promise.all([
    // PENDING decks are still uploading (the uploader shows that itself).
    db.deckAnalysis.findMany({
      where: { createdAt: { gte: since }, status: { not: "PENDING" } },
      select: { id: true, fileName: true, intakeOnly: true, ventureId: true, venture: { select: { name: true } }, ...common },
    }),
    db.memoAnalysis.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, number: true, ventureId: true, venture: { select: { name: true } }, ...common },
    }),
    db.dDReportJob.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, ventureId: true, venture: { select: { name: true } }, document: { select: { fileName: true } }, ...common },
    }),
  ]);

  const jobs: Job[] = [
    ...decks.map((d) => ({
      id: d.id,
      kind: d.intakeOnly ? ("intake" as const) : ("eligibility" as const),
      ventureName: d.venture?.name ?? d.fileName,
      href: d.ventureId ? `/deals/${d.ventureId}` : "/deals/new",
      ...effectiveDeckStatus(d),
      startedAt: (d.startedAt ?? d.createdAt).toISOString(),
      result: d.intakeOnly ? "Deck stored, ready to screen" : "Eligibility screen ready",
    })),
    ...memos.map((m) => ({
      id: m.id,
      kind: "assessment" as const,
      ventureName: m.venture.name,
      href: `/deals/${m.ventureId}/assessment?view=ai-${m.number}`,
      ...effectiveDeckStatus(m),
      startedAt: (m.startedAt ?? m.createdAt).toISOString(),
      result: `${aiDraftName(m.number)} ready`,
    })),
    ...dds.map((j) => ({
      id: j.id,
      kind: "dd" as const,
      ventureName: j.venture.name,
      href: `/deals/${j.ventureId}#due-diligence`,
      ...effectiveDeckStatus(j),
      startedAt: (j.startedAt ?? j.createdAt).toISOString(),
      result: j.document ? "DD document ready" : null,
    })),
  ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}
