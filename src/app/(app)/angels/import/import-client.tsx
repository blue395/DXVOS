"use client";

// Import angels from a CSV (e.g. the Squarespace sign-up export). The file is read in
// the browser; you match each column to an angel field (the choice is remembered for
// files with the same columns), check the preview, then import.

import { useState } from "react";
import Link from "next/link";
import type { AngelStatus } from "@/generated/prisma/enums";
import { buttonClass, Spinner } from "@/components/ui";
import { guessMapping, IMPORT_FIELDS, mapRow, parseCsv, type ImportField, type ImportRow } from "@/lib/angel-import";
import { ANGEL_STATUS_LABELS, CERTIFICATION_LABELS } from "@/lib/pipeline";
import { actionErrorMessage } from "@/lib/stale-version";
import { importAngels } from "../actions";

const CHUNK = 250; // rows per request
// Dropdowns sized to their content (the shared inputClass is full width).
const selectClass = "rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm focus:border-dxv-green focus:outline-none";
const memoryKey = (headers: string[]) => `dxv-angel-import:${headers.join("|").toLowerCase()}`;

function remembered(headers: string[]): (ImportField | null)[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(memoryKey(headers)) ?? "null");
    return Array.isArray(v) && v.length === headers.length ? v : null;
  } catch {
    return null;
  }
}

type Result = { created: number; updated: number; certifications: number; skipped: number };

export function AngelImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [status, setStatus] = useState<AngelStatus>("MEMBER");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);

  const colName = (i: number) => (headers[i] ? `"${headers[i]}"` : `column ${i + 1}`);
  /** First non-empty value in this column, to show what it holds. */
  const example = (i: number) => data.find((r) => r[i]?.trim())?.[i]?.trim() ?? "";
  const matchedCount = mapping.filter(Boolean).length;

  /** Set column i's field. A field fills from one column only, so it moves from any other column (and we say so). */
  function choose(i: number, field: ImportField | null) {
    const from = field ? mapping.findIndex((m, j) => m === field && j !== i) : -1;
    setMapping((m) => m.map((v, j) => (j === i ? field : field && v === field ? null : v)));
    setMoved(from >= 0 && field ? `${IMPORT_FIELDS[field]} now comes from ${colName(i)} (no longer from ${colName(from)}).` : null);
  }

  async function load(file: File) {
    setError(null);
    setResult(null);
    if (!/\.csv$/i.test(file.name)) return setError("Choose a .csv file (in Excel: File → Save As → CSV).");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError("That file has no rows under the header.");
    const [head, ...rest] = rows;
    setFileName(file.name);
    setHeaders(head);
    setData(rest);
    setMapping(remembered(head) ?? guessMapping(head));
  }

  const mapped = data.map((r) => mapRow(r, mapping));
  const valid = mapped.filter((r): r is ImportRow => !!r);
  const hasName = mapping.includes("name") || mapping.includes("firstName") || mapping.includes("email");

  async function run() {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      localStorage.setItem(memoryKey(headers), JSON.stringify(mapping));
    } catch {
      // remembering the mapping is a convenience only
    }
    const total: Result = { created: 0, updated: 0, certifications: 0, skipped: data.length - valid.length };
    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const res = await importAngels(valid.slice(i, i + CHUNK), status);
        if ("error" in res) throw new Error(res.error);
        total.created += res.created;
        total.updated += res.updated;
        total.certifications += res.certifications;
        total.skipped += res.skipped;
        setProgress(Math.min(valid.length, i + CHUNK));
      }
      setResult(total);
    } catch (e) {
      setError(actionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 rounded-lg border border-dxv-green/30 bg-dxv-green/[0.04] p-4 text-sm">
        <p className="font-semibold text-dxv-green">✓ Import finished</p>
        <ul className="list-disc pl-5">
          <li>{result.created} new angels added</li>
          <li>{result.updated} existing angels updated (blank fields filled in, sectors added; nothing overwritten)</li>
          <li>{result.certifications} certifications recorded</li>
          {result.skipped > 0 && <li>{result.skipped} rows skipped (no name or email, or repeated in the file)</li>}
        </ul>
        <div className="flex gap-2">
          <Link href="/angels" className={buttonClass()}>
            View angels
          </Link>
          <button type="button" className={buttonClass("secondary")} onClick={() => (setResult(null), setHeaders([]), setData([]), setFileName(null))}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block rounded-lg border-2 border-dashed border-dxv-green/30 bg-dxv-green/[0.03] p-5 text-center text-sm transition hover:border-dxv-green">
        <span className="font-medium text-dxv-green">{fileName ? `${fileName}: ${data.length} rows. Choose a different file` : "Choose a CSV file"}</span>
        <span className="block text-xs text-black/50">e.g. the Squarespace form export. Read in your browser; nothing is saved until you import.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
      </label>

      {error && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {headers.length > 0 && (
        <>
          <div className="rounded-lg border border-black/10 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">1. Match the columns</h2>
              <label className="flex items-center gap-1.5 text-xs text-black/60">
                <input type="checkbox" checked={matchedOnly} onChange={(e) => setMatchedOnly(e.target.checked)} />
                Show only matched columns ({matchedCount} of {headers.length})
              </label>
            </div>
            <p className="px-4 pt-3 text-xs text-black/55">
              For each column in your file (left), choose the DXV OS field it fills (right), or leave it as Don&apos;t import. Each field can come from one
              column only, so choosing a field that another column already fills moves it here.
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
                        onChange={(e) => choose(i, (e.target.value || null) as ImportField | null)}
                        className={`${selectClass} ${mapping[i] ? "border-dxv-green font-medium text-dxv-green" : "text-black/60"}`}
                      >
                        <option value="">Don&apos;t import</option>
                        {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((f) => {
                          const from = mapping.findIndex((m, j) => m === f && j !== i);
                          return (
                            <option key={f} value={f}>
                              {IMPORT_FIELDS[f]}
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

          <div className="rounded-lg border border-black/10 bg-white">
            <h2 className="border-b border-black/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">2. Check and import</h2>
            <div className="space-y-3 p-4 text-sm">
              <label className="flex flex-wrap items-center gap-2">
                New angels without a status column are added as
                <select value={status} onChange={(e) => setStatus(e.target.value as AngelStatus)} className={`${selectClass} w-40`}>
                  {(Object.keys(ANGEL_STATUS_LABELS) as AngelStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ANGEL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-black/50">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Name</th>
                      <th className="py-1 pr-3 font-medium">Email</th>
                      <th className="py-1 pr-3 font-medium">Sectors</th>
                      <th className="py-1 pr-3 font-medium">Certification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {valid.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-3">{r.name}</td>
                        <td className="py-1 pr-3">{r.email ?? <span className="text-black/40">none</span>}</td>
                        <td className="py-1 pr-3">{r.sectors ?? "–"}</td>
                        <td className="py-1 pr-3">
                          {r.certType ? `${CERTIFICATION_LABELS[r.certType]}${r.certSignedOn ? `, signed ${r.certSignedOn.slice(0, 10)}` : " (no date: not recorded)"}` : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-black/60">
                {valid.length} of {data.length} rows will be imported{valid.length > 5 ? " (first 5 shown)" : ""}. Existing angels are matched by email and only
                have blank fields filled in.
              </p>
              {!hasName && <p className="text-black">Match a name or email column to import.</p>}
              <button type="button" onClick={() => void run()} disabled={busy || !hasName || !valid.length} className={buttonClass()}>
                {busy ? (
                  <>
                    <Spinner /> Importing {progress}/{valid.length}…
                  </>
                ) : (
                  `Import ${valid.length} angels`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
