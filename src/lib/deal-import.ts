// Historical deals import: DXV's older declined deals from a spreadsheet (CSV), so the
// dealflow record starts from day one. Parse the file, guess which column is which, and
// turn values into deal fields. Pure; used in the browser (the column mapper) and by the
// import action. Unit-tested. (CSV parsing and dates are shared with the angels import.)
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { parseImportDate } from "./angel-import";
import { normaliseCompanyStage } from "./pipeline";

export { parseCsv } from "./angel-import";

/** Deal fields a CSV column can fill. */
export const DEAL_IMPORT_FIELDS = {
  name: "Company name",
  founderNames: "Founder name(s)",
  founderEmail: "Founder email",
  website: "Website",
  sector: "Sector",
  companyStage: "Company stage (e.g. Seed)",
  raise: "Raise amount (£)",
  round: "DXV round",
  leadAngel: "Lead angel",
  description: "Description",
  submittedOn: "Date received",
  declinedOn: "Date declined",
  declinedAt: "Stage it was declined at",
  reason: "Decline reason",
  note: "Notes",
} as const;
export type DealImportField = keyof typeof DEAL_IMPORT_FIELDS;

const GUESSES: [DealImportField, RegExp][] = [
  ["founderEmail", /e-?mail/i],
  ["founderNames", /founder|ceo|contact\s*name/i],
  ["name", /^(company|business|venture|startup|deal)(\s*name)?$|^name$/i],
  ["website", /web|url|site/i],
  ["sector", /sector|industry|vertical/i],
  ["companyStage", /company\s*stage|funding\s*stage|^stage$|round\s*type/i],
  ["raise", /raise|raising|amount|ask|target/i],
  ["round", /dxv\s*round|cohort|^round$/i],
  ["leadAngel", /lead/i],
  ["declinedOn", /(declin|pass|reject).*(date|on|when)|date.*(declin|pass|reject)/i],
  ["declinedAt", /(declin|pass|reject).*(stage|at|step)|stage.*(declin|pass|reject)|pipeline\s*stage|furthest/i],
  ["reason", /reason|why/i],
  ["submittedOn", /date|received|submitted|applied|created/i],
  ["description", /descri|summary|about|pitch|one.?liner/i],
  ["note", /notes?|comments?|feedback/i],
];

/** A best guess at which field each column holds (null = don't import). Each field is used once. */
export function guessDealMapping(headers: string[]): (DealImportField | null)[] {
  const used = new Set<DealImportField>();
  return headers.map((h) => {
    const hit = GUESSES.find(([f, re]) => !used.has(f) && re.test(h.trim()));
    if (!hit) return null;
    used.add(hit[0]);
    return hit[0];
  });
}

/** "£250k", "250,000", "£1.2m", "1.5 million" → whole pounds. */
export function parsePounds(raw: string | undefined): number | null {
  const t = raw?.trim().toLowerCase().replace(/[£,\s]|gbp/g, "");
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m|mn|million|thousand)?$/);
  if (!m) return null;
  const mult = !m[2] ? 1 : m[2].startsWith("k") || m[2] === "thousand" ? 1_000 : 1_000_000;
  return Math.round(parseFloat(m[1]) * mult);
}

/** "Round 3", "R3", "3" → 3. */
export function parseRound(raw: string | undefined): number | null {
  const m = raw?.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return n >= 1 && n <= 99 ? n : null;
}

/** Where in DXV's dealflow a deal was declined, from how old records describe it. */
export function parseDeclinedStage(raw: string | undefined): Stage | null {
  const t = raw?.trim().toLowerCase() ?? "";
  if (!t) return null;
  if (/due\s*dil|\bdd\b/.test(t)) return "DUE_DILIGENCE";
  if (/commit|\beoi\b|expression/.test(t)) return "INVESTMENT_COMMITMENTS";
  if (/pitch.*(select|vote)|select/.test(t)) return "PITCH_SELECTION";
  if (/pitch/.test(t)) return "PITCH_OUTCOME";
  if (/partner|review|memo|assess/.test(t)) return "PARTNER_REVIEW";
  if (/eligib|screen|triage/.test(t)) return "ELIGIBILITY_SCREEN";
  if (/submit|applica|inbound|intake|received/.test(t)) return "SUBMITTED";
  return null;
}

/** The decline reason, if the text clearly says which (anything else is kept as a note under "Other"). */
export function parsePassReason(raw: string | undefined): PassReason | null {
  const t = raw?.trim().toLowerCase() ?? "";
  if (!t) return null;
  if (/valuation|too expensive|price/.test(t)) return "VALUATION_GAP";
  if (/withdr|pulled out|founder.*(declin|left|chose)/.test(t)) return "FOUNDER_WITHDREW";
  if (/\bdd\b|due\s*dil|red\s*flag/.test(t)) return "DD_FLAG";
  if (/interest|appetite|demand|votes?/.test(t)) return "INSUFFICIENT_INTEREST";
  if (/eligib|criteria|thesis|not a fit|\bfit\b|seis|eis|stage|geograph|sector/.test(t)) return "INELIGIBLE";
  if (/^other$/.test(t)) return "OTHER";
  return null;
}

/** Stages a historical deal can have been declined at (before any investment). */
export const DECLINE_STAGES: Stage[] = [
  "SUBMITTED",
  "ELIGIBILITY_SCREEN",
  "PARTNER_REVIEW",
  "PITCH_SELECTION",
  "PITCH_OUTCOME",
  "INVESTMENT_COMMITMENTS",
  "DUE_DILIGENCE",
];

/** One deal, as the import action receives it (dates as yyyy-mm-dd). */
export type DealImportRow = {
  name: string;
  founderNames: string | null;
  founderEmail: string | null;
  website: string | null;
  sector: string | null;
  companyStage: string | null;
  raiseAmountGbp: number | null;
  round: number | null;
  leadAngel: string | null;
  description: string | null;
  submittedOn: string | null;
  declinedOn: string | null;
  declinedAt: Stage | null;
  reason: PassReason | null;
  /** The reason as written, when it didn't match one of DXV's reasons (kept in the note). */
  reasonText: string | null;
  note: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Turn one CSV row into a deal, or null if it has no company name. */
export function mapDealRow(row: string[], mapping: (DealImportField | null)[]): DealImportRow | null {
  const get = (f: DealImportField) => {
    const i = mapping.indexOf(f);
    const v = i >= 0 ? row[i]?.trim() : "";
    return v ? v : undefined;
  };
  const name = get("name");
  if (!name) return null;
  const reasonRaw = get("reason");
  const reason = parsePassReason(reasonRaw);
  const website = get("website");
  return {
    name: name.slice(0, 200),
    founderNames: get("founderNames") ?? null,
    founderEmail: get("founderEmail")?.toLowerCase() ?? null,
    website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
    sector: get("sector") ?? null,
    companyStage: normaliseCompanyStage(get("companyStage")),
    raiseAmountGbp: parsePounds(get("raise")),
    round: parseRound(get("round")),
    leadAngel: get("leadAngel") ?? null,
    description: get("description") ?? null,
    submittedOn: iso(parseImportDate(get("submittedOn"))),
    declinedOn: iso(parseImportDate(get("declinedOn"))),
    declinedAt: parseDeclinedStage(get("declinedAt")),
    reason,
    reasonText: reason && reason !== "OTHER" ? null : (reasonRaw ?? null),
    note: get("note") ?? null,
  };
}

/**
 * How the deal is recorded as declined: where (the row's stage, or the default chosen for
 * the file), why (the row's reason; text that matched no reason is kept as the note under
 * "Other"), and when (the dates in the file; a decline never predates the deal).
 */
export function resolveDecline(
  row: DealImportRow,
  defaults: { stage: Stage; reason: PassReason },
  today: Date = new Date(),
): { passedFromStage: Stage; passReason: PassReason; passNote: string | null; createdAt: Date; declinedAt: Date } {
  const passReason = row.reason ?? (row.reasonText ? "OTHER" : defaults.reason);
  const parts = [row.reasonText, row.note].filter(Boolean);
  let passNote = parts.length ? parts.join(". ") : null;
  if (passReason === "OTHER" && !passNote) passNote = "No reason recorded (historical import)";
  const submitted = row.submittedOn ? new Date(`${row.submittedOn}T12:00:00Z`) : null;
  const declined = row.declinedOn ? new Date(`${row.declinedOn}T12:00:00Z`) : null;
  const createdAt = submitted ?? declined ?? today;
  const declinedAt = declined && declined > createdAt ? declined : createdAt;
  return { passedFromStage: row.declinedAt ?? defaults.stage, passReason, passNote, createdAt, declinedAt };
}

/** Company names compared for duplicates: case, punctuation and "Ltd"/"Limited" ignored. */
export function normaliseCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(ltd|limited|plc|inc|llp|llc|co|uk)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
