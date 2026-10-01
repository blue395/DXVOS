// Insights charts: plain HTML, server-rendered, in one hue (DXV green, light to dark).
// Thin marks with rounded data ends and 2px gaps, a quiet baseline, direct labels only on
// the values that matter (peak, latest), a hover/focus tooltip on every mark, and a
// "Show as a table" view under each chart. No colour is ever the only way to read a value.

import Link from "next/link";

type Point = { key: string; label: string; value: number };
type Row = { label: string; value: number; href?: string };
const plain = (n: number) => n.toLocaleString("en-GB");

/** A headline number: label, value, a short note. */
export function StatTile({ label, value, note, href }: { label: string; value: string | number; note?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-black/55">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-dxv-green">{value}</p>
      {note && <p className="mt-1 text-xs text-black/55">{note}</p>}
    </>
  );
  const cls = "block rounded-xl border border-black/10 bg-white p-4";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-dxv-green/40 hover:shadow-sm`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Columns over time (oldest left). The last column can be marked as still in progress. */
export function ColumnChart({
  title,
  points,
  format = plain,
  partialLast,
  unit,
}: {
  title: string;
  points: Point[];
  format?: (n: number) => string;
  /** The last period isn't over yet (shown lighter, labelled "so far"). */
  partialLast?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <figure className="space-y-2">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative">
        <span className="absolute -top-1 left-0 text-[11px] tabular-nums text-black/40">{format(max)}</span>
        <div className="flex h-40 items-end gap-[2px] border-b border-black/25 pt-5" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}>
          {points.map((p, i) => {
            const last = i === points.length - 1;
            const showLabel = p.value > 0 && (i === peak || last);
            return (
              <div key={p.key} tabIndex={0} className="group relative flex h-full flex-1 flex-col justify-end outline-none" aria-label={`${p.label}: ${format(p.value)}`}>
                {showLabel && <span className="mb-0.5 text-center text-[11px] font-medium tabular-nums text-black/70">{format(p.value)}</span>}
                <div
                  className={`mx-auto w-full max-w-12 rounded-t-[4px] transition-colors ${last && partialLast ? "bg-dxv-green/35" : "bg-dxv-green"} group-hover:bg-black group-focus:bg-black`}
                  style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 2 : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                  {p.label}: <strong>{format(p.value)}</strong>
                  {unit ? ` ${unit}` : ""}
                  {last && partialLast ? ` (${partialLast})` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[2px]">
          {points.map((p, i) => (
            <span key={p.key} className="flex-1 truncate text-center text-[10px] text-black/50">
              {i % every === 0 || i === points.length - 1 ? p.label : ""}
            </span>
          ))}
        </div>
      </div>
      <TableView headers={["Period", unit ?? "Value"]} rows={points.map((p) => [p.label, format(p.value)])} />
    </figure>
  );
}

/** Horizontal bars, biggest first, each labelled with its value. */
export function BarList({ rows, format = plain, empty = "Nothing to show yet." }: { rows: Row[]; format?: (n: number) => string; empty?: string }) {
  if (rows.length === 0 || rows.every((r) => r.value === 0)) return <p className="text-sm text-black/50">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="truncate text-sm text-black/75" title={r.label}>
              {r.label}
            </span>
            <span className="h-3.5" aria-hidden>
              <span className="block h-full rounded-r-[4px] bg-dxv-green transition-colors group-hover:bg-black" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 2 : 0 }} />
            </span>
            <span className="text-right text-sm font-medium tabular-nums">{format(r.value)}</span>
          </>
        );
        const cls = "group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded";
        return (
          <li key={r.label}>
            {r.href ? (
              <Link href={r.href} className={`${cls} hover:bg-dxv-green/5`}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Steps people pass through: each bar against the first, with the share kept from the step before. */
export function Funnel({ steps }: { steps: Row[] }) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const kept = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3">
            <span className="text-sm text-black/75">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-6 min-w-[2px] rounded-r-[4px] bg-dxv-green" style={{ width: `${(s.value / first) * 100}%`, opacity: 1 - i * 0.1 }} aria-hidden />
              <span className="shrink-0 text-sm font-semibold tabular-nums">{plain(s.value)}</span>
              {kept !== null && prev! > 0 && <span className="shrink-0 text-xs text-black/50">{kept}% of previous</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One share against its whole (e.g. members on the platform). */
export function Meter({ label, pct, note }: { label: string; pct: number; note?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-black/75">{label}</span>
        <span className="font-semibold tabular-nums text-dxv-green">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-dxv-green/10" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-dxv-green" style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="text-xs text-black/50">{note}</p>}
    </div>
  );
}

/** The numbers behind a chart, for anyone who'd rather read them. */
export function TableView({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-black/50 hover:text-dxv-green">Show as a table</summary>
      <table className="mt-2 w-full text-left">
        <thead className="text-black/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="py-1 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="py-1 pr-3 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
