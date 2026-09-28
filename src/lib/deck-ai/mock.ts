// A stand-in for the Anthropic client, returning a canned analysis. Used by unit
// tests, and by local development when DECK_AI_MOCK=true (never in production).
import type Anthropic from "@anthropic-ai/sdk";
import type { DeckAnalysisOutput } from "./schema";

export function sampleOutput(fileName: string): DeckAnalysisOutput {
  const company = fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim() || "Sample Co";
  return {
    extracted: {
      name: company,
      founderNames: "Amara Okafor, Priya Shah",
      founderEmail: null,
      website: "https://example.com",
      sector: "Healthtech",
      companyStage: "Pre-seed",
      raiseAmountGbp: 250000,
      description: `${company} helps community pharmacies manage repeat prescriptions. It sells to independent pharmacies in the UK.`,
    },
    screen: {
      companyName: company,
      oneLineSummary: "Repeat-prescription software for independent UK pharmacies.",
      recommendation: "Need more information",
      stageFit: { rating: "Pre-seed", reasoning: "Raising a £250k pre-seed round with a working pilot." },
      sector: { name: "Healthtech", note: "No concern" },
      teamStrength: "Two co-founders with pharmacy operations and software backgrounds; no hires yet.",
      thesisFit: { rating: "Not stated", reasoning: "The deck does not state the founders' backgrounds." },
      redFlags: [],
      nextStep: "Request from founder: confirmation of founder background against DXV's thesis",
    },
  };
}

/** Minimal fake with the one method analyzeDeck uses. */
export function fakeAnthropicClient(
  opts: { output?: DeckAnalysisOutput | null; stopReason?: string; onRequest?: (params: unknown) => void } = {},
): Anthropic {
  return {
    messages: {
      parse: async (params: { messages: { content: { title?: string }[] }[] }) => {
        opts.onRequest?.(params);
        const title = params.messages[0]?.content[0]?.title ?? "deck.pdf";
        return {
          model: "mock-model",
          stop_reason: opts.stopReason ?? "end_turn",
          parsed_output: opts.output === undefined ? sampleOutput(title) : opts.output,
          usage: { input_tokens: 1234, output_tokens: 567 },
        };
      },
    },
  } as unknown as Anthropic;
}
