// Asks Claude for lesson suggestions (text only, no deck). Returns house-styled suggestions.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { applyHouseStyle } from "../deck-ai/render";
import { renderLessonContext, type LessonJobContext } from "./context";
import { LESSON_AI_MODEL, LESSON_SYSTEM_PROMPT, LESSON_USER_INSTRUCTIONS } from "./prompt";
import { LessonSuggestionError, LessonSuggestionsSchema, MAX_SUGGESTIONS, type SuggestedLesson } from "./schema";

export type LessonSuggestionResult = { lessons: SuggestedLesson[]; model: string; inputTokens: number; outputTokens: number };

export async function suggestLessons(client: Anthropic, context: LessonJobContext): Promise<LessonSuggestionResult> {
  const response = await client.messages.parse({
    model: LESSON_AI_MODEL,
    max_tokens: 4000,
    system: LESSON_SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: `${renderLessonContext(context)}\n\n${LESSON_USER_INSTRUCTIONS}` }] }],
    output_config: { format: zodOutputFormat(LessonSuggestionsSchema) },
  });
  if (response.stop_reason === "refusal") throw new LessonSuggestionError("Claude declined to suggest lessons.");
  if (response.stop_reason === "max_tokens") throw new LessonSuggestionError("The suggestions were cut off.");
  if (!response.parsed_output) throw new LessonSuggestionError("The suggestions didn't match the expected format.");

  const lessons = response.parsed_output.lessons
    .map((l) => ({ ...l, title: applyHouseStyle(l.title), body: applyHouseStyle(l.body) }))
    .filter((l) => l.title && l.body)
    .slice(0, MAX_SUGGESTIONS);
  return { lessons, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
