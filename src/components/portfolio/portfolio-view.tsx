// Portfolio building blocks shared by the member portal's "My portfolio" and the team's
// syndicate Portfolio: the headline band, breakdown bars and the founder diversity card.
// One colour per job (DXV green bars, yellow accents), values always written as text.
// Server-component safe.
import { formatMoneyMinor, type CurrencyTotals } from "@/lib/pipeline";

export const formatMultiple = (m: number | null) => (m === null ? "–" : `${m.toFixed(2)}x`);

/** The headline figures on a DXV green band. */
export function HeadlineBand({ tiles }: { tiles: { label: string; value: string; hint?: string; accent?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-dxv-green text-white shadow-sm">
      <div className="grid grid-cols-2 divide-white/10 md:grid-cols-5 md:divide-x">
        {tiles.map((t) => (
          <div key={t.label} className="p-4" title={t.hint}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.accent ? "text-dxv-yellow" : "text-white"}`}>{t.value}</p>
            {t.hint && <p className="mt-1 text-[11px] leading-snug text-white/55">{t.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Totals in other currencies, never converted. */
export function OtherCurrencies({ totals }: { totals: CurrencyTotals[] }) {
  if (totals.length === 0) return null;
  return (
    <p className="text-sm text-black/65">
      {totals.map((c) => (
        <span key={c.currency} className="mr-3 inline-block">
          Plus in {c.currency} (not converted): invested {formatMoneyMinor(c.investedMinor, c.currency)}, value today{" "}
          {formatMoneyMinor(c.valueMinor, c.currency)}, {formatMultiple(c.multiple)}.
        </span>
      ))}
    </p>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 inline-block border-b-2 border-dxv-yellow pb-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">{children}</h2>
  );
}

/** Invested amount per group: one-colour bars with the amount and share written beside each. */
export function Breakdown({ title, rows, total }: { title: string; rows: { label: string; investedMinor: number; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.investedMinor));
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <PanelTitle>{title}</PanelTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-black/55">No GBP investments yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} title={`${r.label}: ${formatMoneyMinor(r.investedMinor)} across ${r.count} compan${r.count === 1 ? "y" : "ies"}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-black/80">{r.label}</span>
                <span className="shrink-0 tabular-nums text-black/70">
                  {formatMoneyMinor(r.investedMinor)}
                  {total > 0 && <span className="ml-1 text-xs text-black/45">{Math.round((r.investedMinor / total) * 100)}%</span>}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-dxv-green/10">
                <div className="h-full rounded-full bg-dxv-green" style={{ width: `${(r.investedMinor / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Founder diversity: each theme with how many companies carry it (a company can carry several). */
export function DiversityCard({ themes, notRecorded, companies, note }: { themes: { label: string; count: number }[]; notRecorded: number; companies: number; note?: string }) {
  const max = Math.max(1, ...themes.map((t) => t.count));
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <PanelTitle>By founder diversity</PanelTitle>
      {themes.length === 0 ? (
        <p className="text-sm text-black/55">No founder diversity themes recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {themes.map((t) => (
            <li key={t.label} className="flex items-center gap-2.5 text-sm" title={`${t.label}: ${t.count} of ${companies} compan${companies === 1 ? "y" : "ies"}`}>
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-dxv-yellow px-1.5 text-xs font-bold tabular-nums text-dxv-green">
                {t.count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-black/80">{t.label}</span>
                <span className="mt-0.5 block h-1.5 rounded-full bg-dxv-green/10">
                  <span className="block h-full rounded-full bg-dxv-green" style={{ width: `${(t.count / max) * 100}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {notRecorded > 0 && (
        <p className="mt-3 text-xs text-black/50">
          {notRecorded} compan{notRecorded === 1 ? "y has" : "ies have"} no themes recorded.{note ? ` ${note}` : ""}
        </p>
      )}
    </section>
  );
}
