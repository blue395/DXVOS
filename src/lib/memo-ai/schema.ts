// The memo's shape: enforced by structured outputs, then validated with zod.
// Shared with the Netlify worker (no Next-only imports).
import { z } from "zod";

/** Playbook version 0's eleven scoring criteria (DXV's template order). The criteria in use
 *  now come from the Playbook; each memo keeps the criteria it was scored against. */
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

export const ScoreSchema = z.object({
  criterion: z.string(),
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

/** The shape Claude must return: scores limited to this run's criteria names. */
export function memoContentSchema(criteria: readonly string[]) {
  return MemoContentSchema.extend({
    scores: z.array(ScoreSchema.extend({ criterion: z.enum(criteria as [string, ...string[]]) })),
  });
}

export type MemoScore = z.infer<typeof ScoreSchema>;
export type MemoContent = z.infer<typeof MemoContentSchema>;

export class MemoFormatError extends Error {}

/**
 * Exactly one score per criterion, in template order. Throws if any are missing
 * or duplicated (the model is told to give all eleven; a gap means a bad draft).
 */
export function normaliseScores(scores: MemoScore[], criteria: readonly string[] = CRITERIA): MemoScore[] {
  const byCriterion = new Map<string, MemoScore>();
  for (const s of scores) {
    if (byCriterion.has(s.criterion)) throw new MemoFormatError(`The AI scored "${s.criterion}" twice. Try again.`);
    byCriterion.set(s.criterion, s);
  }
  const missing = criteria.filter((c) => !byCriterion.has(c));
  if (missing.length) throw new MemoFormatError(`The AI didn't score: ${missing.join(", ")}. Try again.`);
  return criteria.map((c) => byCriterion.get(c)!);
}

export function totalScore(scores: MemoScore[]): number {
  return scores.reduce((a, s) => a + s.score, 0);
}

/** A memo's maximum score: 5 per criterion it was scored against (55 for version 0's eleven). */
export function maxScore(scores: MemoScore[]): number {
  return scores.length * 5;
}
