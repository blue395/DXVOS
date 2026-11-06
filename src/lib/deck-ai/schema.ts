// The exact shape Claude must return (enforced by the API's structured outputs,
// then validated again by zod when parsed). Shared with the Netlify worker.
import { z } from "zod";
import { lenientChoice, matchChoice } from "../ai-choices";

export const RECOMMENDATIONS = ["Proceed to pipeline", "Decline", "Need more information"] as const;
export const STAGE_FIT_RATINGS = ["Pre-seed", "Seed", "Series A+", "Pre-deck", "Unclear"] as const;
export const THESIS_FIT_RATINGS = [
  "Confirmed underestimated-founder status",
  "Stated impact-and-inclusion focus without confirmed founder status",
  "Not stated",
  "Unclear",
] as const;

export const ExtractedFieldsSchema = z.object({
  name: z.string().nullable(),
  founderNames: z.string().nullable(),
  founderEmail: z.string().nullable(),
  website: z.string().nullable(),
  sector: z.string().nullable(),
  companyStage: z.string().nullable(),
  raiseAmountGbp: z.number().int().nullable(),
  description: z.string().nullable(),
});

export const EligibilityScreenSchema = z.object({
  companyName: z.string(),
  oneLineSummary: z.string(),
  recommendation: z.enum(RECOMMENDATIONS),
  stageFit: z.object({ rating: z.enum(STAGE_FIT_RATINGS), reasoning: z.string() }),
  sector: z.object({ name: z.string(), note: z.string() }),
  teamStrength: z.string(),
  thesisFit: z.object({ rating: z.enum(THESIS_FIT_RATINGS), reasoning: z.string() }),
  redFlags: z.array(z.string()),
  nextStep: z.string(),
  // DXV's additional eligibility criteria (beyond the four core ones), from the Playbook.
  // Screens from before 2026-09-30 don't have this: read it as `otherCriteria ?? []`.
  otherCriteria: z.array(z.object({ criterion: z.string(), assessment: z.string() })),
});

export const DeckAnalysisOutputSchema = z.object({
  extracted: ExtractedFieldsSchema,
  screen: EligibilityScreenSchema,
});

/** Near-miss stage labels Claude has used (or might), mapped onto DXV's options. */
const STAGE_SYNONYMS: Record<string, (typeof STAGE_FIT_RATINGS)[number]> = {
  preseed: "Pre-seed",
  "pre seed round": "Pre-seed",
  "seed round": "Seed",
  "seed extension": "Seed",
  "seed plus": "Seed",
  "seed+": "Seed",
  "post seed": "Seed",
  "series a": "Series A+",
  "series b": "Series A+",
  "series c": "Series A+",
  "series a or later": "Series A+",
  growth: "Series A+",
  "later stage": "Series A+",
  idea: "Pre-deck",
  "idea stage": "Pre-deck",
  concept: "Pre-deck",
};

/** A rated criterion: an unrecognised rating becomes "Unclear", and the reasoning keeps what Claude wrote. */
const ratedCriterion = <T extends string>(allowed: readonly T[], synonyms: Record<string, T> = {}) =>
  z.object({ rating: z.unknown(), reasoning: z.string() }).transform((o) => {
    const rating = matchChoice(o.rating, allowed, synonyms);
    return rating
      ? { rating, reasoning: o.reasoning }
      : { rating: "Unclear" as T, reasoning: `${o.reasoning} (The AI's own label was "${String(o.rating)}".)`.trim() };
  });

/**
 * How Claude's answer is read (src/lib/ai-choices.ts): the same shape as DeckAnalysisOutputSchema,
 * which is still what's sent, but a near-miss label no longer fails the whole screen.
 */
export const LenientDeckAnalysisOutputSchema = DeckAnalysisOutputSchema.extend({
  screen: EligibilityScreenSchema.extend({
    recommendation: lenientChoice(RECOMMENDATIONS, { fallback: "Need more information", synonyms: { proceed: "Proceed to pipeline", "more information needed": "Need more information" } }),
    stageFit: ratedCriterion(STAGE_FIT_RATINGS, STAGE_SYNONYMS),
    thesisFit: ratedCriterion(THESIS_FIT_RATINGS),
  }),
});

export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;
export type EligibilityScreen = z.infer<typeof EligibilityScreenSchema>;
export type DeckAnalysisOutput = z.infer<typeof DeckAnalysisOutputSchema>;

/** Venture form fields the AI can pre-fill (keys match the form's input names). */
export const EXTRACTED_FIELD_KEYS = Object.keys(ExtractedFieldsSchema.shape) as (keyof ExtractedFields)[];
