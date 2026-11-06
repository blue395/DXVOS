// Shape of the AI's lesson suggestions. Shared with the worker.
import { z } from "zod";
import { lenientChoice } from "../ai-choices";

export const SuggestedLessonSchema = z.object({
  title: z.string(),
  body: z.string(),
  scope: z.enum(["ELIGIBILITY", "ASSESSMENT", "DUE_DILIGENCE", "GENERAL"]),
});

export const LessonSuggestionsSchema = z.object({ lessons: z.array(SuggestedLessonSchema) });

/** How Claude's suggestions are read: an unrecognised scope becomes GENERAL (src/lib/ai-choices.ts). */
export const LenientLessonSuggestionsSchema = z.object({
  lessons: z.array(SuggestedLessonSchema.extend({ scope: lenientChoice(["ELIGIBILITY", "ASSESSMENT", "DUE_DILIGENCE", "GENERAL"] as const, { fallback: "GENERAL" }) })),
});

export type SuggestedLesson = z.infer<typeof SuggestedLessonSchema>;

export const MAX_SUGGESTIONS = 3;

export class LessonSuggestionError extends Error {}
