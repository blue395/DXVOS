// The Partner Review round summary: what the AI writes per deal, and the partners'
// working copy. Pure; shared with the Netlify worker (relative imports only).
import { z } from "zod";

/** What the AI writes for one deal (short: the whole round should read in a few minutes). */
export const dealSummarySchema = z.object({
  headline: z.string().describe("Two or three sentences: what the company does, for whom, and why it's in front of DXV now."),
  dealTerms: z
    .string()
    .describe('Raise, valuation or cap and instrument as the deck states them, e.g. "£250k SEIS on a £2m pre-money". "Not stated" if the deck doesn\'t say.'),
  strengths: z.array(z.string()).describe("The 3 most material strengths, specific and evidenced (numbers where the deck gives them)."),
  concerns: z.array(z.string()).describe("The 3 most material concerns or risks, specific."),
  dxvFit: z.string().describe("One or two sentences on fit with DXV's impact and inclusion thesis."),
  impactThemes: z.array(z.string()).describe("DXV impact themes that apply (from the list given), or none."),
  diversityThemes: z.array(z.string()).describe("DXV diversity themes the deck or correspondence states directly. Never inferred. Empty if not stated."),
  keyQuestion: z.string().describe("The single most important open question to resolve with the founders."),
});
export type DealSummaryAi = z.infer<typeof dealSummarySchema>;

export class RoundSummaryError extends Error {}

export const TAKE_TO_PITCH = ["STRONG_YES", "YES", "MAYBE", "NO"] as const;
export type TakeToPitch = (typeof TAKE_TO_PITCH)[number];
export const TAKE_TO_PITCH_LABELS: Record<TakeToPitch, string> = { STRONG_YES: "Strong Yes", YES: "Yes", MAYBE: "Maybe", NO: "No" };

/** App-owned facts for the "Round at a glance" table (from DXV OS, never the model). */
export type DealFacts = {
  oneLiner: string | null;
  sector: string | null;
  stage: string | null;
  raise: string | null;
  eligibility: string | null;
  memoScore: string | null;
};

/** One deal in the partners' working copy. */
export type SummaryDeal = DealSummaryAi & {
  ventureId: string;
  name: string;
  facts: DealFacts;
  /** Why the AI couldn't summarise this deal (the partners can still write it). */
  error: string | null;
  partnerView: string;
  takeToPitch: TakeToPitch | null;
};

export type RoundSummaryContent = { intro: string; deals: SummaryDeal[] };

/** The AI's output for the round, as written (never edited). */
export type RoundSummaryAiOutput = { deals: { ventureId: string; summary: DealSummaryAi | null; error: string | null }[] };
