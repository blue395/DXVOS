// Shape of the AI's lesson suggestions. Shared with the worker.
import { z } from "zod";

export const SuggestedLessonSchema = z.object({
  title: z.string(),
  body: z.string(),
  scope: z.enum(["ELIGIBILITY", "ASSESSMENT", "DUE_DILIGENCE", "GENERAL"]),
});

export const LessonSuggestionsSchema = z.object({ lessons: z.array(SuggestedLessonSchema) });

export type SuggestedLesson = z.infer<typeof SuggestedLessonSchema>;

export const MAX_SUGGESTIONS = 3;

export class LessonSuggestionError extends Error {}
