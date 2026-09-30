import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass, formatDate } from "@/components/ui";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  HOLDING_STATUS_LABELS,
  INSTRUMENT_LABELS,
  formatGbp,
  formatMoneyMinor,
  holdingMultiple,
  holdingValueMinor,
  latestCertification,
  nextOnboardingStep,
  portfolioDates,
  portfolioSummary,
  stageLabel,
} from "@/lib/pipeline";
import { loadPortfolio, type PortfolioRow } from "@/lib/portfolio";

export const metadata = { title: "My portfolio · DXV Members" };

const multiple = (m: number | null) => (m === null ? "–" : `${m.toFixed(2)}x`);

/** The angel's investments in one place: DXV syndicate investments (automatic) and their own. */
export default async function PortfolioPage() {
  const { angel } = await requireAngel();
  const [certs, { rows, pendingInterest }] = await Promise.all([
    db.angelCertification.findMany({ where: { angelId: angel.id }, select: { signedOn: true, expiresOn: true } }),
    loadPortfolio(angel.id),
  ]);
  const step = nextOnboardingStep(angel, latestCertification(certs));
  if (step !== "done") redirect(`/portal/${step}`);

  const summary = portfolioSummary(rows);
  const gbp = summary.byCurrency.find((c) => c.currency === "GBP");
  const others = summary.byCurrency.filter((c) => c.currency !== "GBP");
  const dates = portfolioDates(rows).slice(0, 8);
  const counted = rows.filter((r) => !r.pending);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">My portfolio</h1>
          <p className="text-sm text-black/65">
            Your DXV syndicate investments appear here automatically. Add the ones you&apos;ve made elsewhere to see everything in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows.length > 0 && (
            <a href="/api/portal/portfolio" className={buttonClass("secondary")}>
              Download CSV
            </a>
          )}
          <Link href="/portal/portfolio/new" className={buttonClass()}>
            + Add an investment
          </Link>
        </div>
      </div>

      {rows.length === 0 && pendingInterest.length === 0 ? (
        <p className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/65">
          Nothing here yet. When you invest through DXV it appears automatically; you can add investments made directly or through other syndicates
          and platforms with <strong>+ Add an investment</strong>.
        </p>
      ) : (
        <>
          {/* Headline numbers (GBP) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="Invested" value={formatMoneyMinor(gbp?.investedMinor ?? 0)} />
            <Tile label="Value today" value={formatMoneyMinor(gbp?.valueMinor ?? 0)} hint="Your latest valuations; at cost where you haven't revalued" />
            <Tile label="Multiple" value={multiple(gbp?.multiple ?? null)} hint="(Value today + money received) ÷ invested" />
            <Tile
              label="Companies"
              value={String(summary.companies)}
              hint={`${summary.active} active · ${summary.exited} exited · ${summary.writtenOff} written off · ${summary.viaDxv} via DXV`}
            />
            <Tile label="Est. S/EIS relief" value={formatMoneyMinor(summary.reliefMinor)} hint="SEIS 50%, EIS 30% of the amount: an estimate, not tax advice" />
          </div>
          {others.map((c) => (
            <p key={c.currency} className="text-sm text-black/65">
              Plus in {c.currency} (not converted): invested {formatMoneyMinor(c.investedMinor, c.currency)}, value today{" "}
              {formatMoneyMinor(c.valueMinor, c.currency)}, {multiple(c.multiple)}.
            </p>
          ))}

          {(summary.pending.length > 0 || pendingInterest.length > 0) && (
            <section className="rounded-lg border border-dxv-yellow bg-dxv-yellow/10 p-4 text-sm">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">In progress with DXV</h2>
              <ul className="space-y-0.5">
                {summary.pending.map((p) => (
                  <li key={p.company}>
                    <strong>{p.company}</strong>: your {formatMoneyMinor(p.amountMinor ?? 0)} ticket is waiting for payment to be confirmed.
                  </li>
                ))}
                {pendingInterest.map((p) => (
                  <li key={p.ventureId}>
                    <strong>{p.company}</strong>: you expressed interest up to {formatGbp(p.maxTicketGbp)} ({stageLabel(p.stage)}).
                  </li>
                ))}
              </ul>
            </section>
          )}

          {counted.length > 0 && (
            // Wider than the portal's reading column so every column fits.
            <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
              <div className="mx-auto max-w-6xl overflow-x-auto rounded-lg border border-black/10 bg-white">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-dxv-green/[0.04] text-xs uppercase tracking-wide text-black/55">
                    <tr>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Invested</th>
                      <th className="px-3 py-2 font-medium">Round</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-right font-medium">Shares</th>
                      <th className="px-3 py-2 text-right font-medium">Value today</th>
                      <th className="px-3 py-2 text-right font-medium">Multiple</th>
                      <th className="px-3 py-2 font-medium">S/EIS</th>
                      <th className="px-3 py-2 font-medium">Share cert</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {counted.map((r) => (
                      <HoldingRow key={r.key} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Breakdown title="By sector (GBP)" rows={summary.bySector} total={gbp?.investedMinor ?? 0} />
            <Breakdown title="By year invested (GBP)" rows={summary.byYear} total={gbp?.investedMinor ?? 0} />
            <section className="rounded-lg border border-black/10 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">Coming up</h2>
              {dates.length === 0 ? (
                <p className="text-sm text-black/55">No dates to diarise. S/EIS holding periods and key dates you add appear here.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {dates.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{formatDate(d.date)}</span> · {d.company}
                      <span className="block text-xs text-black/55">{d.what}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <p className="text-xs text-black/50">
        Private to you: the DXV team doesn&apos;t see investments you add here. Values are your own estimates and relief figures are indicative only;
        they aren&apos;t tax or investment advice. S/EIS relief depends on your circumstances and on holding the shares for three years.
      </p>
    </div>
  );
}

function HoldingRow({ r }: { r: PortfolioRow }) {
  const m = holdingMultiple(r);
  return (
    <tr className="align-top">
      <td className="px-3 py-2.5">
        <span className="font-semibold text-dxv-green">{r.company}</span>
        {r.source === "DXV" && <span className="ml-1.5 rounded bg-dxv-green px-1.5 py-px text-[10px] font-bold tracking-wide text-white">DXV</span>}
        {r.status !== "ACTIVE" && (
          <span className={`ml-1.5 rounded px-1.5 py-px text-[10px] font-semibold ${r.status === "EXITED" ? "bg-dxv-yellow text-dxv-green" : "bg-black text-white"}`}>
            {HOLDING_STATUS_LABELS[r.status]}
          </span>
        )}
        <span className="block text-xs text-black/55">{[r.description, r.sector, r.source === "OUTSIDE" ? r.investedVia : null].filter(Boolean).join(" · ")}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{r.investedOn ? formatDate(r.investedOn) : "–"}</td>
      <td className="px-3 py-2.5">
        {r.round ?? "–"}
        {r.instrument && <span className="block text-xs text-black/55">{INSTRUMENT_LABELS[r.instrument]}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{r.amountMinor != null ? formatMoneyMinor(r.amountMinor, r.currency) : "–"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {r.shares != null ? r.shares.toLocaleString("en-GB") : "–"}
        {r.sharePrice != null && <span className="block text-xs text-black/55">@ {r.sharePrice}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {r.status === "EXITED" ? (
          <>
            {formatMoneyMinor(r.proceedsMinor ?? 0, r.currency)}
            <span className="block text-xs text-black/55">received</span>
          </>
        ) : r.status === "WRITTEN_OFF" ? (
          <>
            {formatMoneyMinor(0, r.currency)}
            <span className="block text-xs text-black/55">written off</span>
          </>
        ) : (
          <>
            {formatMoneyMinor(holdingValueMinor(r), r.currency)}
            <span className="block text-xs text-black/55">{r.currentValueMinor != null ? (r.currentValueOn ? `at ${formatDate(r.currentValueOn)}` : "your value") : "at cost"}</span>
          </>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{m === null ? "–" : `${m.toFixed(2)}x`}</td>
      <td className="px-3 py-2.5">
        {r.taxScheme && r.taxScheme !== "NONE" ? (
          <>
            {r.taxScheme}
            <span className="block text-xs text-black/55">{r.taxCertificateReceived ? "✓ certificate" : r.dxvCertificatesStage ? "Certificates being issued" : "Certificate awaited"}</span>
          </>
        ) : (
          (r.taxScheme === "NONE" ? "None" : "–")
        )}
      </td>
      <td className="px-3 py-2.5">{r.shareCertificateReceived ? "✓ Received" : <span className="text-black/50">Awaited</span>}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <Link
          href={r.finalInvestmentId ? `/portal/portfolio/dxv/${r.finalInvestmentId}` : `/portal/portfolio/${r.holdingId}`}
          className="text-sm font-medium text-dxv-green underline"
        >
          {r.finalInvestmentId ? "My details" : "Edit"}
        </Link>
      </td>
    </tr>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3" title={hint}>
      <p className="text-xs font-medium uppercase tracking-wide text-black/55">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-dxv-green">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-black/50">{hint}</p>}
    </div>
  );
}

/** Invested amount per group, as bars of one colour with the value written beside each. */
function Breakdown({ title, rows, total }: { title: string; rows: { label: string; investedMinor: number; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.investedMinor));
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-black/55">No GBP investments yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-sm"
              title={`${r.label}: ${formatMoneyMinor(r.investedMinor)} across ${r.count} compan${r.count === 1 ? "y" : "ies"}${total ? ` (${Math.round((r.investedMinor / total) * 100)}%)` : ""}`}
            >
              <span className="truncate text-black/75">{r.label}</span>
              <span className="h-3">
                <span className="block h-full rounded-r-[4px] bg-dxv-green" style={{ width: `${(r.investedMinor / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-black/75">{formatMoneyMinor(r.investedMinor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
