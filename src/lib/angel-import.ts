// Angel CSV import (e.g. the Squarespace sign-up export): parse the file, guess which
// column is which, and turn values into Angel fields. Pure; used in the browser (the
// column mapper) and by the import action. Unit-tested.
import type { AngelStatus, CertificationType } from "@/generated/prisma/enums";

/** Parse CSV text (RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, ""); // Excel's byte-order mark
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

/** Angel fields a CSV column can fill. */
export const IMPORT_FIELDS = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  linkedinUrl: "LinkedIn",
  location: "Location",
  sectors: "Sectors of interest",
  source: "How they heard about DXV",
  status: "Status",
  certType: "Certification type",
  certSignedOn: "Certification signed date",
  joinedAt: "Member since (sign-up date)",
  bio: "Bio / notes",
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;

const GUESSES: [ImportField, RegExp][] = [
  ["email", /e-?mail/i],
  ["firstName", /^(first|given|fore)\s*name/i],
  ["lastName", /^(last|family|sur)\s*name|^surname/i],
  ["name", /^(full|billing|customer|contact|your)?\s*name$/i],
  ["phone", /phone|mobile|tel/i],
  ["linkedinUrl", /linked\s*in/i],
  ["location", /location|city|town|region|country/i],
  ["sectors", /sector|interest|industr/i],
  ["certType", /(investor|certif|self.?cert).*(type|category|statement)|investor\s*type|categor/i],
  ["certSignedOn", /(certif|statement|signed).*(date|on)|date.*(certif|signed)/i],
  ["source", /hear|source|referr/i],
  ["joinedAt", /submitted|joined|sign.?up|member\s*since|registered/i],
  ["status", /^status|member(ship)?\s*status/i],
  ["bio", /bio|about|notes?$|message/i],
];

/** A best guess at which field each column holds (null = don't import). Each field is used once. */
export function guessMapping(headers: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const hit = GUESSES.find(([f, re]) => !used.has(f) && re.test(h.trim()));
    if (!hit) return null;
    used.add(hit[0]);
    return hit[0];
  });
}

/** Dates as they appear in UK exports: 2026-10-01, 01/10/2026 (day first), 1 Oct 2026, Oct 1, 2026. */
export function parseImportDate(raw: string | undefined): Date | null {
  const t = raw?.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return utc(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return utc(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  const parsed = new Date(t);
  return isNaN(parsed.getTime()) ? null : utc(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function utc(y: number, mo: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

/** "High net worth", "HNW", "Self-certified sophisticated investor", ... */
export function parseCertType(raw: string | undefined): CertificationType | null {
  const t = raw?.toLowerCase() ?? "";
  if (/high\s*net|hnw|hnwi/.test(t)) return "HIGH_NET_WORTH";
  if (/sophisticated/.test(t)) return /self/.test(t) || !/certified/.test(t) ? "SELF_CERTIFIED_SOPHISTICATED" : "CERTIFIED_SOPHISTICATED";
  return null;
}

export function parseStatus(raw: string | undefined): AngelStatus | null {
  const t = raw?.toLowerCase().trim() ?? "";
  if (/lapsed|former|inactive|left/.test(t)) return "LAPSED";
  if (/prospect|lead|potential|interested|pending/.test(t)) return "PROSPECT";
  if (/member|active|current/.test(t)) return "MEMBER";
  return null;
}

/** One CSV row, as the import action receives it. */
export type ImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  sectors: string | null;
  source: string | null;
  status: AngelStatus | null;
  certType: CertificationType | null;
  certSignedOn: string | null; // ISO date
  joinedAt: string | null; // ISO date: when they signed up / became a member
  bio: string | null;
};

/** Apply a column mapping to one CSV row. Null when the row has no name or email to go on. */
export function mapRow(cells: string[], mapping: (ImportField | null)[]): ImportRow | null {
  const get = (f: ImportField) => {
    const i = mapping.indexOf(f);
    const v = i >= 0 ? cells[i]?.trim() : "";
    return v ? v : null;
  };
  const email = get("email")?.toLowerCase() ?? null;
  const name = get("name") ?? ([get("firstName"), get("lastName")].filter(Boolean).join(" ") || null);
  if (!name && !email) return null;
  const signed = parseImportDate(get("certSignedOn") ?? undefined);
  const joined = parseImportDate(get("joinedAt") ?? undefined);
  return {
    name: name ?? email!.split("@")[0],
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: get("phone"),
    linkedinUrl: get("linkedinUrl"),
    location: get("location"),
    sectors: get("sectors"),
    source: get("source"),
    status: parseStatus(get("status") ?? undefined),
    certType: parseCertType(get("certType") ?? undefined),
    certSignedOn: signed ? signed.toISOString() : null,
    joinedAt: joined ? joined.toISOString() : null,
    bio: get("bio"),
  };
}
