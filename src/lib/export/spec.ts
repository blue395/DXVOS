// A small, format-neutral description of a DXV document: a cover and a list of blocks.
// Each document type (eligibility screen, memo, DD report) is described once as a
// DocSpec; docx.ts and pdf.ts render the same spec to Word and PDF, so both
// exports always match. Pure; shared with the Netlify worker (relative imports only).

export type Block =
  | { kind: "heading"; text: string } // section heading (green, yellow rule)
  | { kind: "subheading"; text: string } // small green label
  | { kind: "paragraph"; text: string; italic?: boolean; muted?: boolean; bold?: boolean }
  | { kind: "bullets"; items: string[]; empty?: string }
  | { kind: "keyValue"; rows: [string, string][]; blank?: string } // label/value table
  | { kind: "table"; headers: string[]; rows: string[][]; widths: number[] } // widths: fractions summing to 1
  | { kind: "notice"; text: string } // highlighted callout (e.g. the AI review banner)
  | { kind: "box"; title: string; prompt: string } // a space for the team to write in
  | { kind: "spacer" }
  | { kind: "pageBreak" };

export type DocSpec = {
  /** e.g. "Due Diligence Report", "DXV Review Issue 2" */
  title: string;
  /** The venture name */
  subtitle: string;
  /** Running header on every page, e.g. "DXV Due Diligence | Papcup" */
  runningHeader: string;
  /** App-rendered notice on the cover (never model-generated). */
  notice?: string;
  /** Key facts table on the cover. */
  summary: [string, string][];
  /** Start the body on a new page (long documents). */
  coverPageBreak?: boolean;
  blocks: Block[];
};

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";

/** "DXV DD Report - Papcup - 2026-09-29.pdf" (safe characters only). */
export function exportFileName(docName: string, ventureName: string, date: Date, ext: "pdf" | "docx"): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, " ");
  return `${safe(docName) || "DXV document"} - ${safe(ventureName) || "Venture"} - ${date.toISOString().slice(0, 10)}.${ext}`;
}

export function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);
}
