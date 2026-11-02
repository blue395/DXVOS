// The members' opportunities pack: what the AI drafts per company, and the partners'
// working copy. Pure; shared with the Netlify worker (relative imports only).
import { z } from "zod";

/** What the AI drafts for one company's slide (short: one slide each). */
export const opportunitySchema = z.object({
  summary: z.string().describe("Three or four sentences: what the company does, for whom, the problem and why now."),
  dateFounded: z.string().describe('Year founded, e.g. "2023". "Not stated" if the materials don\'t say.'),
  revenue: z.string().describe('Revenue to date as stated, e.g. "£57k in 2026 and £240k signed contracts", or "Pre-revenue". "Not stated" if unknown.'),
  traction: z
    .string()
    .describe("Early traction: the most concrete evidence (customers, pilots, users, partnerships, IP), with numbers, in one or two sentences."),
  useOfFunds: z.string().describe("What the raise will be spent on, in one sentence."),
  taxScheme: z.string().describe('"SEIS", "EIS", "SEIS/EIS", with "(advance assurance pending)" etc. if stated, or "TBC".'),
  raising: z.string().describe('Round and amount with any notable terms, e.g. "Pre-seed £400k (first tranche closed)".'),
  assessment: z
    .string()
    .describe("DXV's assessment in three or four sentences: why it's interesting and the key risks, balanced, drawing on DXV's issued memo."),
  theme: z.string().describe("The one DXV impact theme this company is grouped under, from the list given."),
});
export type OpportunityAi = z.infer<typeof opportunitySchema>;

export class OpportunityError extends Error {}

/** One company's slide in the working copy. */
export type OpportunityDeal = OpportunityAi & {
  ventureId: string;
  name: string;
  sector: string;
  /** Founders' diversity as shown to members (from the deal's Founder diversity; editable). */
  founderDiversity: string;
  error: string | null;
};

export type OpportunityContent = { title: string; deals: OpportunityDeal[] };
export type OpportunityAiOutput = { deals: { ventureId: string; draft: OpportunityAi | null; error: string | null }[] };

/** Fields the partners edit on each slide, in slide order (the form and the renderer share it). */
export const OPPORTUNITY_FIELDS = [
  ["theme", "Impact theme (slide group)"],
  ["sector", "Sector"],
  ["taxScheme", "EIS/SEIS"],
  ["dateFounded", "Date founded"],
  ["founderDiversity", "Founders' diversity"],
  ["raising", "Raising"],
  ["summary", "Summary"],
  ["revenue", "Revenue to date"],
  ["traction", "Early traction"],
  ["useOfFunds", "Use of funds"],
  ["assessment", "DXV assessment"],
] as const satisfies readonly (readonly [keyof OpportunityDeal, string])[];
export type OpportunityField = (typeof OPPORTUNITY_FIELDS)[number][0];
