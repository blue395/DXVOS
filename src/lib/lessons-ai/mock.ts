// Stand-in lesson suggestions for tests and local development (DECK_AI_MOCK=true, never production).
import type Anthropic from "@anthropic-ai/sdk";
import type { SuggestedLesson } from "./schema";

export function sampleLessons(): SuggestedLesson[] {
  return [
    {
      title: "Ask for the cap table before member pitch selection",
      body: "Sample lesson: valuation gaps surfaced late. Requesting the fully diluted cap table at partner review lets DXV test the valuation before angels spend time on the pitch.",
      scope: "ASSESSMENT",
    },
  ];
}

export function fakeLessonClient(opts: { lessons?: SuggestedLesson[] | null; stopReason?: string; onRequest?: (p: unknown) => void } = {}): Anthropic {
  return {
    messages: {
      parse: async (params: unknown) => {
        opts.onRequest?.(params);
        const ms = Number(process.env.DECK_AI_MOCK_DELAY_MS ?? 0);
        if (ms > 0) await new Promise((r) => setTimeout(r, Math.min(ms, 3000)));
        return {
          model: "mock-model",
          stop_reason: opts.stopReason ?? "end_turn",
          parsed_output: opts.lessons === null ? null : { lessons: opts.lessons ?? sampleLessons() },
          usage: { input_tokens: 1200, output_tokens: 300 },
        };
      },
    },
  } as unknown as Anthropic;
}
