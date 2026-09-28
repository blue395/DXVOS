// The exact shape Claude must return (enforced by the API's structured outputs,
// then validated again by zod when parsed). Shared with the Netlify worker.
import { z } from "zod";

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
});

export const DeckAnalysisOutputSchema = z.object({
  extracted: ExtractedFieldsSchema,
  screen: EligibilityScreenSchema,
});

export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;
export type EligibilityScreen = z.infer<typeof EligibilityScreenSchema>;
export type DeckAnalysisOutput = z.infer<typeof DeckAnalysisOutputSchema>;

/** Venture form fields the AI can pre-fill (keys match the form's input names). */
export const EXTRACTED_FIELD_KEYS = Object.keys(ExtractedFieldsSchema.shape) as (keyof ExtractedFields)[];
