import Link from "next/link";
import { buttonClass, formatDate } from "@/components/ui";
import { Breakdown, DiversityCard, formatMultiple, HeadlineBand, OtherCurrencies } from "@/components/portfolio/portfolio-view";
import { requireAdminWith } from "@/lib/auth";
import { HOLDING_STATUS_LABELS, diversityBreakdown, formatMoneyMinor, holdingMultiple, holdingValueMinor, portfolioSummary, stageLabel } from "@/lib/pipeline";
import { loadSyndicatePortfolio, type SyndicateRow } from "@/lib/syndicate-portfolio";

export const metadata = { title: "Portfolio · DXV OS" };

/** DXV's syndicate portfolio: invested deals (from their paid tickets) and investments the team added by hand. */
export default async function PortfolioPage() {
  const { rows, angelsInvesting } = await requireAdminWith(() => loadSyndicatePortfolio());
  const summary = portfolioSummary(rows);
  const gbp = summary.byCurrency.find((c) => c.currency === "GBP");
  const diversity = diversityBreakdown(rows);
  const counted = rows.filter((r) => !r.pending);
  const pending = rows.filter((r) => r.pending);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Portfolio</h1>
          <p className="text-sm text-black/60">
            Every company the DXV syndicate has invested in. Deals at Investment Complete appear automatically from their paid Final Investment
            tickets; add earlier investments that aren&apos;t tracked as deals.
          </p>
        </div>
        <Link href="/portfolio/new" className={buttonClass()}>
          + Add a syndicate investment
        </Link>
      </div>

      <HeadlineBand
        tiles={[
          { label: "Invested by the syndicate", value: formatMoneyMinor(gbp?.investedMinor ?? 0) },
          { label: "Value today", value: formatMoneyMinor(gbp?.valueMinor ?? 0), hint: "The team's latest valuations; at cost otherwise" },
          { label: "Multiple", value: formatMultiple(gbp?.multiple ?? null), hint: "(Value today + money received) ÷ invested", accent: true },
          {
            label: "Companies",
            value: String(summary.companies),
            hint: `${summary.active} active · ${summary.exited} exited · ${summary.writtenOff} written off`,
          },
          { label: "Angels investing", value: String(angelsInvesting), hint: "Distinct angels with a paid ticket on a tracked deal" },
        ]}
      />
      <OtherCurrencies totals={summary.byCurrency.filter((c) => c.currency !== "GBP")} />

      {pending.length > 0 && (
        <p className="rounded-lg border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {pending.map((p) => p.company).join(", ")} {pending.length === 1 ? "is" : "are"} at Investment Complete with no paid tickets yet: tick
          payments in Final investment on the deal page to count {pending.length === 1 ? "it" : "them"} here.
        </p>
      )}

      {counted.length === 0 ? (
        <p className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/60">
          No investments yet. Deals appear here once they reach Investment Complete with paid tickets.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-dxv-green text-xs uppercase tracking-wide text-white/85">
              <tr>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Round</th>
                <th className="px-3 py-2 font-medium">Invested</th>
                <th className="px-3 py-2 text-right font-medium">Syndicate amount</th>
                <th className="px-3 py-2 text-right font-medium">Angels</th>
                <th className="px-3 py-2 text-right font-medium">Value today</th>
                <th className="px-3 py-2 text-right font-medium">Multiple</th>
                <th className="px-3 py-2 font-medium">S/EIS</th>
                <th className="px-3 py-2 font-medium">Founder diversity</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {counted.map((r) => (
                <Row key={r.key} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="By sector (GBP)" rows={summary.bySector} total={gbp?.investedMinor ?? 0} />
        <Breakdown title="By year invested (GBP)" rows={summary.byYear} total={gbp?.investedMinor ?? 0} />
        <DiversityCard themes={diversity.themes} notRecorded={diversity.notRecorded} companies={summary.companies} />
      </div>
      <p className="text-xs text-black/50">
        Values are the team&apos;s own estimates. Founder diversity comes from each deal&apos;s Details (its single source of truth, also used by
        members&apos; portfolios) and only records what founders have stated.
      </p>
    </div>
  );
}

function Row({ r }: { r: SyndicateRow }) {
  const m = holdingMultiple(r);
  return (
    <tr className="align-top transition hover:bg-dxv-yellow/10">
      <td className="px-3 py-2.5">
        {r.ventureId ? (
          <Link href={`/deals/${r.ventureId}`} className="font-semibold text-dxv-green hover:underline">
            {r.company}
          </Link>
        ) : (
          <span className="font-semibold text-dxv-green">{r.company}</span>
        )}
        {!r.ventureId && <span className="ml-1.5 rounded bg-black/10 px-1.5 py-px text-[10px] font-semibold">Added</span>}
        {r.status !== "ACTIVE" && (
          <span className={`ml-1.5 rounded px-1.5 py-px text-[10px] font-semibold ${r.status === "EXITED" ? "bg-dxv-yellow text-dxv-green" : "bg-black text-white"}`}>
            {HOLDING_STATUS_LABELS[r.status]}
          </span>
        )}
        <span className="block max-w-xs text-xs text-black/55">{[r.description, r.sector].filter(Boolean).join(" · ")}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {r.round ? `Round ${r.round}` : "–"}
        {r.companyStage && <span className="block text-xs text-black/55">{r.companyStage}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {r.investedOn ? formatDate(r.investedOn) : "–"}
        {r.stage && <span className="block text-xs text-black/55">{stageLabel(r.stage)}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{r.amountMinor != null ? formatMoneyMinor(r.amountMinor, r.currency) : "–"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{r.angelsCount ?? "–"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {r.status === "EXITED" ? formatMoneyMinor(r.proceedsMinor ?? 0, r.currency) : formatMoneyMinor(holdingValueMinor(r), r.currency)}
        <span className="block text-xs text-black/55">
          {r.status === "EXITED" ? "received" : r.status === "WRITTEN_OFF" ? "written off" : r.currentValueMinor != null ? (r.currentValueOn ? `at ${formatDate(r.currentValueOn)}` : "revalued") : "at cost"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatMultiple(m)}</td>
      <td className="px-3 py-2.5">{r.taxScheme && r.taxScheme !== "NONE" ? r.taxScheme : r.taxScheme === "NONE" ? "None" : "–"}</td>
      <td className="px-3 py-2.5">
        {r.diversityThemes.length ? (
          <span className="flex max-w-[14rem] flex-wrap gap-1">
            {r.diversityThemes.map((t) => (
              <span key={t} className="rounded-full bg-dxv-yellow/50 px-2 py-px text-[11px] text-dxv-green">
                {t}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-black/40">Not recorded</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <Link href={r.ventureId ? `/portfolio/deal/${r.ventureId}` : `/portfolio/${r.holdingId}`} className="text-sm font-medium text-dxv-green underline">
          {r.ventureId ? "Details" : "Edit"}
        </Link>
      </td>
    </tr>
  );
}
