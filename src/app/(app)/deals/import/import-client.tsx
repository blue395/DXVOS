"use client";

// Import DXV's older declined deals from a CSV (e.g. an old tracker exported from Excel or
// Google Sheets). The file is read in the browser; you match the columns, choose what to
// assume when a row doesn't say, check the preview, then import.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { buttonClass, Spinner } from "@/components/ui";
import { ColumnMapper, importSelectClass, rememberedMapping, rememberMapping } from "@/components/column-mapper";
import {
  DEAL_IMPORT_FIELDS,
  DECLINE_STAGES,
  guessDealMapping,
  mapDealRow,
  normaliseCompanyName,
  parseCsv,
  resolveDecline,
  type DealImportField,
  type DealImportRow,
} from "@/lib/deal-import";
import { PASS_REASON_LABELS, PASS_REASONS, stageLabel } from "@/lib/pipeline";
import { actionErrorMessage } from "@/lib/stale-version";
import { existingDealNames, importDeclinedDeals } from "./actions";

const CHUNK = 250; // rows per request
const MEMORY = "dxv-deal-import";
type Result = { created: number; duplicates: string[]; invalid: number };

export function DealImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(DealImportField | null)[]>([]);
  const [stage, setStage] = useState<Stage>("ELIGIBILITY_SCREEN");
  const [reason, setReason] = useState<PassReason>("OTHER");
  const [existing, setExisting] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Company names already in DXV OS, to flag duplicates in the preview.
  useEffect(() => {
    if (!headers.length || existing) return;
    existingDealNames()
      .then((names) => setExisting(new Set(names)))
      .catch((e) => setError(actionErrorMessage(e)));
  }, [headers.length, existing]);

  async function load(file: File) {
    setError(null);
    setResult(null);
    if (!/\.csv$/i.test(file.name)) return setError("Choose a .csv file (in Excel: File → Save As → CSV; in Google Sheets: File → Download → CSV).");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError("That file has no rows under the header.");
    const [head, ...rest] = rows;
    setFileName(file.name);
    setHeaders(head);
    setData(rest);
    setMapping(rememberedMapping<DealImportField>(MEMORY, head) ?? guessDealMapping(head));
  }

  const mapped = data.map((r) => mapDealRow(r, mapping)).filter((r): r is DealImportRow => !!r);
  // Mark rows DXV OS already has, or that repeat an earlier row in the file.
  const seen = new Set<string>();
  const rows = mapped.map((r) => {
    const key = normaliseCompanyName(r.name);
    const dup = existing?.has(key) ? "Already in DXV OS" : seen.has(key) ? "Repeated in this file" : null;
    seen.add(key);
    return { r, dup };
  });
  const fresh = rows.filter((x) => !x.dup).map((x) => x.r);
  const dupCount = rows.length - fresh.length;
  const hasName = mapping.includes("name");

  async function run() {
    setBusy(true);
    setError(null);
    setProgress(0);
    rememberMapping(MEMORY, headers, mapping);
    const total: Result = { created: 0, duplicates: [], invalid: 0 };
    try {
      for (let i = 0; i < fresh.length; i += CHUNK) {
        const res = await importDeclinedDeals(fresh.slice(i, i + CHUNK), { stage, reason });
        if ("error" in res) throw new Error(res.error);
        total.created += res.created;
        total.duplicates.push(...res.duplicates);
        total.invalid += res.invalid;
        setProgress(Math.min(fresh.length, i + CHUNK));
      }
      setResult(total);
    } catch (e) {
      setError(`${actionErrorMessage(e)}${total.created ? ` (${total.created} deals were added before this.)` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 rounded-lg border border-dxv-green/30 bg-dxv-green/[0.04] p-4 text-sm">
        <p className="font-semibold text-dxv-green">✓ Import finished</p>
        <ul className="list-disc pl-5">
          <li>{result.created} declined deals added, with their original dates</li>
          {dupCount + result.duplicates.length > 0 && <li>{dupCount + result.duplicates.length} skipped: already in DXV OS or repeated in the file</li>}
          {result.invalid > 0 && <li>{result.invalid} rows skipped because a value couldn&apos;t be read</li>}
        </ul>
        <div className="flex gap-2">
          <Link href="/deals?declined=1" className={buttonClass()}>
            View declined deals
          </Link>
          <button type="button" className={buttonClass("secondary")} onClick={() => (setResult(null), setHeaders([]), setData([]), setFileName(null), setExisting(null))}>
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
        <span className="block text-xs text-black/50">One row per deal. Read in your browser; nothing is saved until you import.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
      </label>

      {error && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {headers.length > 0 && (
        <>
          <ColumnMapper headers={headers} data={data} mapping={mapping} onChange={setMapping} fields={DEAL_IMPORT_FIELDS} />

          <div className="rounded-lg border border-black/10 bg-white">
            <h2 className="border-b border-black/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">2. Check and import</h2>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex flex-wrap items-center gap-2">
                  When a row doesn&apos;t say, it was declined at
                  <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={importSelectClass}>
                    {DECLINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {stageLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-wrap items-center gap-2">
                  for the reason
                  <select value={reason} onChange={(e) => setReason(e.target.value as PassReason)} className={importSelectClass}>
                    {PASS_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {PASS_REASON_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-black/50">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Company</th>
                      <th className="py-1 pr-3 font-medium">Received</th>
                      <th className="py-1 pr-3 font-medium">Declined</th>
                      <th className="py-1 pr-3 font-medium">At</th>
                      <th className="py-1 pr-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {rows.slice(0, 8).map(({ r, dup }, i) => {
                      const d = resolveDecline(r, { stage, reason });
                      return (
                        <tr key={i} className={dup ? "text-black/40" : ""}>
                          <td className="py-1 pr-3">
                            {r.name}
                            {dup && <span className="ml-1.5 rounded bg-dxv-yellow/50 px-1 text-black">{dup}: skipped</span>}
                          </td>
                          <td className="py-1 pr-3">{r.submittedOn ?? <span className="text-black/40">no date</span>}</td>
                          <td className="py-1 pr-3">{r.declinedOn ?? <span className="text-black/40">same as received</span>}</td>
                          <td className="py-1 pr-3">{stageLabel(d.passedFromStage)}</td>
                          <td className="py-1 pr-3">
                            {PASS_REASON_LABELS[d.passReason]}
                            {d.passNote && <span className="block text-black/50">{d.passNote}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-black/60">
                {fresh.length} of {data.length} rows will be added to Declined{rows.length > 8 ? " (first 8 shown)" : ""}
                {dupCount > 0 && `; ${dupCount} already in DXV OS or repeated`}
                {data.length > rows.length && `; ${data.length - rows.length} without a company name`}. Rows with no date use today&apos;s. No founder updates are
                flagged and no AI lessons are suggested for these (they were handled at the time). Each deal can be edited or reopened later.
              </p>
              {!hasName && <p className="text-black">Match the company name column to import.</p>}
              <button type="button" onClick={() => void run()} disabled={busy || !hasName || !fresh.length || !existing} className={buttonClass()}>
                {busy ? (
                  <>
                    <Spinner /> Importing {progress}/{fresh.length}…
                  </>
                ) : (
                  `Import ${fresh.length} declined deals`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
