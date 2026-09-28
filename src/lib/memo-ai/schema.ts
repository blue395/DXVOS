// The memo's shape: enforced by structured outputs, then validated with zod.
// Shared with the Netlify worker (no Next-only imports).
import { z } from "zod";

/** The eleven scoring criteria, in DXV's template order. Names are used as keys. */
export const CRITERIA = [
  "Team",
  "Problem Solution fit",
  "Mkt & scalability",
  "Unit Economics",
  "Financial Returns",
  "Valuation",
  "Risks",
  "Market traction",
  "Legal Documentation",
  "Impact",
  "Risks/Red Flags",
] as const;
export type Criterion = (typeof CRITERIA)[number];
export const MAX_TOTAL_SCORE = CRITERIA.length * 5;

export const ScoreSchema = z.object({
  criterion: z.enum(CRITERIA),
  score: z.number().int().min(1).max(5),
  justification: z.string(),
});

export const MemoContentSchema = z.object({
  header: z.object({
    businessName: z.string(),
    round: z.string(),
    stage: z.string(),
    businessModel: z.string(),
    sdgs: z.array(z.string()),
    impactThesis: z.string(),
    impactThemes: z.array(z.string()),
    diversityThemes: z.array(z.string()),
  }),
  executiveSummary: z.string(),
  investmentCase: z.array(z.string()),
  conclusion: z.string(),
  scores: z.array(ScoreSchema),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  followUpQuestions: z.array(z.string()),
});

export type MemoScore = z.infer<typeof ScoreSchema>;
export type MemoContent = z.infer<typeof MemoContentSchema>;

export class MemoFormatError extends Error {}

/**
 * Exactly one score per criterion, in template order. Throws if any are missing
 * or duplicated (the model is told to give all eleven; a gap means a bad draft).
 */
export function normaliseScores(scores: MemoScore[]): MemoScore[] {
  const byCriterion = new Map<Criterion, MemoScore>();
  for (const s of scores) {
    if (byCriterion.has(s.criterion)) throw new MemoFormatError(`The AI scored "${s.criterion}" twice. Try again.`);
    byCriterion.set(s.criterion, s);
  }
  const missing = CRITERIA.filter((c) => !byCriterion.has(c));
  if (missing.length) throw new MemoFormatError(`The AI didn't score: ${missing.join(", ")}. Try again.`);
  return CRITERIA.map((c) => byCriterion.get(c)!);
}

export function totalScore(scores: MemoScore[]): number {
  return scores.reduce((a, s) => a + s.score, 0);
}
