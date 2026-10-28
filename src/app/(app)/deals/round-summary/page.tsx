import Link from "next/link";
import { Card, ExportLinks, formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { impactThemeOptions } from "@/lib/pipeline";
import { currentPlaybook } from "@/lib/playbook/current";
import { defaultSummaryRound, summaryName, takeLabel } from "@/lib/round-summary/build";
import type { RoundSummaryContent } from "@/lib/round-summary/schema";
import { GenerateSummaryButton } from "./generate-button";
import { SummaryEditor } from "./summary-editor";

export const metadata = { title: "Partner Review summary · DXV OS" };

// One document covering every deal at DXV Partner Review in a round, for the partners to
// choose who pitches to the angels. Team only (never shared with members).
export default async function RoundSummaryPage({ searchParams }: PageProps<"/deals/round-summary">) {
  const sp = await searchParams;
  const [ventures, summaries, playbook] = await requireAdminWith(() =>
    Promise.all([
      db.venture.findMany({
        where: { round: { not: null }, currentStage: { not: "PASSED" } },
        select: { id: true, name: true, round: true, currentStage: true },
      }),
      db.roundSummary.findMany({
        orderBy: [{ round: "desc" }, { number: "desc" }],
        select: {
          id: true,
          round: true,
          number: true,
          status: true,
          error: true,
          content: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          editedAt: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      currentPlaybook("ASSESSMENT"),
    ]),
  );

  const atReview = ventures.filter((v) => v.currentStage === "PARTNER_REVIEW");
  const rounds = [...new Set(ventures.map((v) => v.round!))].sort((a, b) => b - a);
  const asked = Number(sp.round);
  const round = rounds.includes(asked) ? asked : (defaultSummaryRound(ventures) ?? rounds[0] ?? null);
  const inRound = atReview.filter((v) => v.round === round).sort((a, b) => a.name.localeCompare(b.name));
  const versions = summaries.filter((s) => s.round === round).map((s) => ({ ...s, effective: effectiveDeckStatus(s) }));
  const running = versions.some((s) => s.effective.status === "PENDING" || s.effective.status === "PROCESSING");
  const picked = versions.find((s) => s.number === Number(sp.v)) ?? versions[0] ?? null;
  const base = (r: number | null, v?: number) => `/deals/round-summary?round=${r}${v ? `&v=${v}` : ""}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div>
        <Link href="/deals" className="text-sm text-dxv-green hover:underline">
          ← Deals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-dxv-green">Partner Review summary</h1>
        <p className="text-sm text-black/60">
          One short document on every deal at DXV Partner Review in a round, to share between the partners and choose who to take to pitch. Team only: never
          shown to members.
        </p>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <p className="text-sm text-black/60">No deals have a round yet. Give deals a round on their Details to summarise them together.</p>
        </Card>
      ) : (
        <>
          <nav aria-label="Rounds" className="flex flex-wrap gap-2">
            {rounds.map((r) => {
              const n = atReview.filter((v) => v.round === r).length;
              return (
                <Link
                  key={r}
                  href={base(r)}
                  aria-current={r === round ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-sm ${r === round ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"}`}
                >
                  Round {r} <span className={r === round ? "text-dxv-yellow" : "text-black/45"}>{n}</span>
                </Link>
              );
            })}
          </nav>

          <Card
            title={`Round ${round}: ${inRound.length} deal${inRound.length === 1 ? "" : "s"} at DXV Partner Review`}
            actions={round !== null && inRound.length > 0 && !running ? <GenerateSummaryButton round={round} again={versions.length > 0} /> : undefined}
          >
            {inRound.length === 0 ? (
              <p className="text-sm text-black/60">No deals in this round are at DXV Partner Review right now.</p>
            ) : (
              <>
                <p className="text-sm text-black/70">{inRound.map((v) => v.name).join(" · ")}</p>
                <p className="mt-1 text-xs text-black/55">
                  The AI reads each deal&apos;s deck, eligibility screen, decisions and memo (if there is one) and writes a short entry; usually 1 to 3 minutes
                  for the round. Generating again makes a new version and keeps your partner views and Take to pitch choices.
                </p>
              </>
            )}
            {running && (
              <p className="mt-2 flex items-center gap-2 text-sm text-dxv-green" aria-live="polite">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
                Writing the summary… progress is in the corner; this page updates when it&apos;s done.
              </p>
            )}
          </Card>

          {versions.length > 0 && (
            <nav aria-label="Summary versions" className="flex flex-wrap gap-2">
              {versions.map((s) => (
                <Link
                  key={s.id}
                  href={base(round, s.number)}
                  aria-current={s.id === picked?.id ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-sm ${s.id === picked?.id ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"}`}
                >
                  {summaryName(s.number)}
                  {s.effective.status === "FAILED" ? " (failed)" : s.effective.status === "COMPLETE" ? "" : " (writing…)"}
                </Link>
              ))}
            </nav>
          )}

          {picked?.effective.status === "FAILED" && (
            <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
              {summaryName(picked.number)} failed: {picked.effective.error}
            </p>
          )}

          {picked?.effective.status === "COMPLETE" &&
            picked.content &&
            (() => {
              const c = picked.content as RoundSummaryContent;
              return (
                <>
                  <Card title={`${summaryName(picked.number)} · Round at a glance`} actions={<ExportLinks href={`/api/export/round-summary/${picked.id}`} />}>
                    {!picked.editedAt && (
                      <p role="note" className="mb-3 rounded-md border-2 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm text-dxv-green">
                        <strong>DRAFT: AI-assisted first pass.</strong> Check and edit it below before sharing; the partners decide who pitches.
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-black/55">
                          <tr>
                            <th className="py-1.5 pr-3 font-medium">Company</th>
                            <th className="py-1.5 pr-3 font-medium">Sector</th>
                            <th className="hidden py-1.5 pr-3 font-medium md:table-cell">Stage</th>
                            <th className="py-1.5 pr-3 font-medium">Raise</th>
                            <th className="hidden py-1.5 pr-3 font-medium md:table-cell">Memo score</th>
                            <th className="py-1.5 font-medium">Take to pitch?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                          {c.deals.map((d) => (
                            <tr key={d.ventureId}>
                              <td className="py-2 pr-3">
                                <a href={`#deal-${d.ventureId}`} className="font-medium text-dxv-green hover:underline">
                                  {d.name}
                                </a>
                              </td>
                              <td className="py-2 pr-3">{d.facts.sector ?? "–"}</td>
                              <td className="hidden py-2 pr-3 md:table-cell">{d.facts.stage ?? "–"}</td>
                              <td className="py-2 pr-3">{d.facts.raise ?? "–"}</td>
                              <td className="hidden py-2 pr-3 md:table-cell">{d.facts.memoScore ?? "–"}</td>
                              <td className="py-2">
                                <span className={d.takeToPitch ? "font-semibold text-dxv-green" : "text-black/45"}>{takeLabel(d.takeToPitch)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-black/50">
                      Generated by {picked.createdBy.name}, {formatDateTime(picked.completedAt ?? picked.createdAt)}
                      {picked.updatedBy && picked.editedAt ? ` · last edited by ${picked.updatedBy.name}, ${formatDateTime(picked.editedAt)}` : ""}. Deals
                      listed as they were when it was generated.
                    </p>
                  </Card>
                  <SummaryEditor
                    id={picked.id}
                    version={picked.editedAt?.toISOString() ?? ""}
                    content={c}
                    impactThemes={impactThemeOptions(playbook.content.impactThemes)}
                  />
                </>
              );
            })()}
        </>
      )}
    </div>
  );
}
