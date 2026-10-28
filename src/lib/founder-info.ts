// What the founders themselves told DXV, for the AI jobs (eligibility screen, investment
// assessment, round summary): their application form answers and founder diversity.
// Founder diversity is special-category data: it comes only from what founders stated
// (the application form, kept only with their consent, or the deal's Founder diversity,
// which the team records only as founders stated it), and the founders consented to DXV
// "using it when assessing my application". Pure renderer + a plain-SQL loader for the
// workers; shared with the Netlify functions (relative imports only, no server-only).
import type { Pool } from "pg";
import { formatGbp } from "./pipeline";

export type FounderApplication = {
  submittedAt: Date;
  pitch: string;
  sector: string | null;
  companyStage: string | null;
  raiseAmountGbp: number | null;
  website: string | null;
  diversityThemes: string[];
};

export type FounderInfo = {
  /** The deal's Founder diversity (Venture.founderDiversity). */
  founderDiversity: string[];
  /** The founders' application form(s), newest first. */
  applications: FounderApplication[];
};

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(d);

/** Founder diversity across the deal and its applications, once each (ignoring case). */
export function statedFounderDiversity(info: FounderInfo): string[] {
  const seen = new Set<string>();
  return [...info.founderDiversity, ...info.applications.flatMap((a) => a.diversityThemes)]
    .map((t) => t.trim())
    .filter((t) => t && !/^(not stated|none|n\/a|unknown|prefer not to say)$/i.test(t) && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}

/** The block of text the AI is given (null when the founders haven't told DXV anything beyond the deck). */
export function renderFounderInfo(info: FounderInfo): string | null {
  const diversity = statedFounderDiversity(info);
  const app = info.applications[0];
  if (!app && !diversity.length) return null;
  const lines = ["What the founders told DXV directly (DXV OS records of the founders' own words, alongside the deck):"];
  if (app) {
    lines.push(
      `Application form (submitted ${day(app.submittedAt)}):`,
      `- What the company does, in their words: ${app.pitch}`,
      ...[
        ["Sector", app.sector],
        ["Stage", app.companyStage],
        ["Raising", app.raiseAmountGbp ? formatGbp(app.raiseAmountGbp) : null],
        ["Website", app.website],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${v}`),
    );
  }
  lines.push(
    diversity.length
      ? `Founder diversity, as the founders stated it themselves (application form, given with their consent, or recorded by DXV's team from what the founders said): ${diversity.join(", ")}. These are the founders' own statements, so they count as stated directly: use them for the diversity themes and DXV thesis fit.`
      : "Founder diversity: the founders haven't stated any (don't infer it).",
  );
  return lines.join("\n");
}

/** Load a deal's founder info with plain SQL (workers). */
export async function loadFounderInfo(pool: Pool, ventureId: string): Promise<FounderInfo> {
  const [v, apps] = await Promise.all([
    pool.query<{ founderDiversity: string[] }>(`SELECT "founderDiversity" FROM "Venture" WHERE id = $1`, [ventureId]),
    pool.query<FounderApplication>(
      `SELECT "createdAt" AS "submittedAt", pitch, sector, "companyStage", "raiseAmountGbp", website, "diversityThemes"
       FROM "FounderSubmission" WHERE "ventureId" = $1 AND status = 'COMPLETE' ORDER BY "createdAt" DESC LIMIT 5`,
      [ventureId],
    ),
  ]);
  return { founderDiversity: v.rows[0]?.founderDiversity ?? [], applications: apps.rows };
}

/** The Prisma include for a venture's applications (use with founderInfoFrom()). */
export const FOUNDER_SUBMISSIONS_INCLUDE = {
  where: { status: "COMPLETE" as const },
  orderBy: { createdAt: "desc" as const },
  take: 5,
  select: { createdAt: true, pitch: true, sector: true, companyStage: true, raiseAmountGbp: true, website: true, diversityThemes: true },
};

/** FounderInfo from a venture loaded with FOUNDER_SUBMISSIONS_INCLUDE. */
export function founderInfoFrom(v: {
  founderDiversity: string[];
  founderSubmissions: {
    createdAt: Date;
    pitch: string;
    sector: string | null;
    companyStage: string | null;
    raiseAmountGbp: number | null;
    website: string | null;
    diversityThemes: string[];
  }[];
}): FounderInfo {
  return { founderDiversity: v.founderDiversity, applications: v.founderSubmissions.map(({ createdAt, ...a }) => ({ submittedAt: createdAt, ...a })) };
}
