"use client";

// "Match the columns" for CSV imports (angels, historical deals): for each column in the
// file, choose the DXV OS field it fills. Each field comes from one column only, so
// choosing a field another column fills moves it here (and says so).

import { useState } from "react";

export const importSelectClass = "rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm focus:border-dxv-green focus:outline-none";

export function ColumnMapper<F extends string>({
  headers,
  data,
  mapping,
  onChange,
  fields,
}: {
  headers: string[];
  data: string[][];
  mapping: (F | null)[];
  onChange: (mapping: (F | null)[]) => void;
  fields: Record<F, string>;
}) {
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const colName = (i: number) => (headers[i] ? `"${headers[i]}"` : `column ${i + 1}`);
  /** First non-empty value in this column, to show what it holds. */
  const example = (i: number) => data.find((r) => r[i]?.trim())?.[i]?.trim() ?? "";
  const matchedCount = mapping.filter(Boolean).length;

  function choose(i: number, field: F | null) {
    const from = field ? mapping.findIndex((m, j) => m === field && j !== i) : -1;
    onChange(mapping.map((v, j) => (j === i ? field : field && v === field ? null : v)));
    setMoved(from >= 0 && field ? `${fields[field]} now comes from ${colName(i)} (no longer from ${colName(from)}).` : null);
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">1. Match the columns</h2>
        <label className="flex items-center gap-1.5 text-xs text-black/60">
          <input type="checkbox" checked={matchedOnly} onChange={(e) => setMatchedOnly(e.target.checked)} />
          Show only matched columns ({matchedCount} of {headers.length})
        </label>
      </div>
      <p className="px-4 pt-3 text-xs text-black/55">
        For each column in your file (left), choose the DXV OS field it fills (right), or leave it as Don&apos;t import. Each field can come from one column
        only, so choosing a field that another column already fills moves it here.
      </p>
      {moved && (
        <p role="status" className="mx-4 mt-2 rounded bg-dxv-yellow/40 px-2 py-1 text-xs">
          {moved}
        </p>
      )}
      <div className="p-4 pt-2">
        <div className="hidden grid-cols-[minmax(0,1fr)_1.5rem_16rem] gap-3 border-b border-black/10 pb-1 text-[11px] font-medium uppercase tracking-wide text-black/45 sm:grid">
          <span>Column in your file (example value)</span>
          <span />
          <span>DXV OS field</span>
        </div>
        <ul className="divide-y divide-black/5">
          {headers.map((h, i) =>
            matchedOnly && !mapping[i] ? null : (
              <li key={i} className={`grid items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_1.5rem_16rem] ${mapping[i] ? "bg-dxv-green/[0.04]" : ""}`}>
                <span className="min-w-0 px-1 text-sm">
                  <span className="block truncate font-medium" title={h}>
                    {h || <em className="font-normal text-black/40">(no header)</em>}
                  </span>
                  <span className="block truncate text-xs text-black/45" title={example(i)}>
                    {example(i) || "empty in the first rows"}
                  </span>
                </span>
                <span aria-hidden className="hidden text-center text-black/30 sm:block">
                  →
                </span>
                <select
                  aria-label={`DXV OS field for column ${h || i + 1}`}
                  value={mapping[i] ?? ""}
                  onChange={(e) => choose(i, (e.target.value || null) as F | null)}
                  className={`${importSelectClass} ${mapping[i] ? "border-dxv-green font-medium text-dxv-green" : "text-black/60"}`}
                >
                  <option value="">Don&apos;t import</option>
                  {(Object.keys(fields) as F[]).map((f) => {
                    const from = mapping.findIndex((m, j) => m === f && j !== i);
                    return (
                      <option key={f} value={f}>
                        {fields[f]}
                        {from >= 0 ? ` (now from "${headers[from] || `column ${from + 1}`}")` : ""}
                      </option>
                    );
                  })}
                </select>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}

/** Column choices remembered per set of headers (a convenience only: storage can be unavailable). */
export function rememberedMapping<F>(prefix: string, headers: string[]): (F | null)[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(`${prefix}:${headers.join("|").toLowerCase()}`) ?? "null");
    return Array.isArray(v) && v.length === headers.length ? v : null;
  } catch {
    return null;
  }
}

export function rememberMapping<F>(prefix: string, headers: string[], mapping: (F | null)[]) {
  try {
    localStorage.setItem(`${prefix}:${headers.join("|").toLowerCase()}`, JSON.stringify(mapping));
  } catch {
    // remembering the mapping is a convenience only
  }
}
