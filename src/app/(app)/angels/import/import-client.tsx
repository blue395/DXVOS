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
import { ColumnMapper, importSelectClass, rememberedMapping, rememberMapping } from "@/components/column-mapper";
import { importAngels } from "../actions";

const CHUNK = 250; // rows per request
// Dropdowns sized to their content (the shared inputClass is full width).
const selectClass = importSelectClass;
const MEMORY = "dxv-angel-import";

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
    setMapping(rememberedMapping<ImportField>(MEMORY, head) ?? guessMapping(head));
  }

  const mapped = data.map((r) => mapRow(r, mapping));
  const valid = mapped.filter((r): r is ImportRow => !!r);
  const hasName = mapping.includes("name") || mapping.includes("firstName") || mapping.includes("email");

  async function run() {
    setBusy(true);
    setError(null);
    setProgress(0);
    rememberMapping(MEMORY, headers, mapping);
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
          <ColumnMapper headers={headers} data={data} mapping={mapping} onChange={setMapping} fields={IMPORT_FIELDS} />

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
