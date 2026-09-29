// DXV's Playbook: the eligibility and assessment criteria the AI works from, as
// editable, versioned content. Pure; shared with the Netlify workers (relative imports only).
import { z } from "zod";

/** The four eligibility criteria the screen's fields are built on: reword them, but they can't be removed. */
export const CORE_ELIGIBILITY = ["stageFit", "sector", "teamStrength", "thesisFit"] as const;
export type CoreEligibility = (typeof CORE_ELIGIBILITY)[number];

const text = z.string().trim().min(1, "This can't be empty");

export const EligibilityCriterionSchema = z.object({
  id: z.string().min(1),
  name: text.max(80),
  guidance: text,
  core: z.enum(CORE_ELIGIBILITY).optional(),
});

export const EligibilityPlaybookSchema = z
  .object({
    intro: text,
    criteria: z.array(EligibilityCriterionSchema).min(1),
    houseStyle: z.array(text),
    closing: z.string().trim(),
  })
  .refine((p) => CORE_ELIGIBILITY.every((c) => p.criteria.filter((x) => x.core === c).length === 1), {
    message: "Stage fit, Sector, Team strength and DXV thesis fit must each stay in the criteria (they can be reworded).",
  })
  .refine((p) => new Set(p.criteria.map((c) => c.name.toLowerCase())).size === p.criteria.length, { message: "Two criteria have the same name." });

export const AssessmentCriterionSchema = z.object({
  id: z.string().min(1),
  name: text.max(60),
  anchors: text,
});

export const AssessmentPlaybookSchema = z
  .object({
    intro: text,
    criteria: z.array(AssessmentCriterionSchema).min(1, "Keep at least one scoring criterion").max(20),
    houseStyle: z.array(text),
    impactThemes: z.array(text),
    diversityThemes: z.array(text),
    taxonomyGuidance: z.string().trim(),
  })
  .refine((p) => new Set(p.criteria.map((c) => c.name.toLowerCase())).size === p.criteria.length, { message: "Two criteria have the same name." });

export type EligibilityPlaybook = z.infer<typeof EligibilityPlaybookSchema>;
export type AssessmentPlaybook = z.infer<typeof AssessmentPlaybookSchema>;
export type PlaybookContent = EligibilityPlaybook | AssessmentPlaybook;

/** An approved lesson, as given to the AI. */
export type LessonForAI = { title: string; body: string };

/** What an AI run was given: the playbook version it used and the approved lessons. Stored with the run. */
export type AiContextSnapshot<T extends PlaybookContent = PlaybookContent> = {
  playbookVersion: number; // 0 = built-in default
  playbook: T;
  lessons: LessonForAI[];
};
