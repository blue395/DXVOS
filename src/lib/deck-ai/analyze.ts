// Sends one deck to Claude and returns validated, house-styled output.
// The Anthropic client is passed in so tests can substitute a fake one.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DECK_AI_MODEL, DECK_USER_INSTRUCTIONS, SCREENING_SYSTEM_PROMPT } from "./prompt";
import { DeckAnalysisOutputSchema, type DeckAnalysisOutput } from "./schema";
import { cleanOutput } from "./render";

export class DeckAnalysisError extends Error {}

export type DeckAnalysisResult = {
  output: DeckAnalysisOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function analyzeDeck(client: Anthropic, pdf: Buffer, fileName: string): Promise<DeckAnalysisResult> {
  const response = await client.messages.parse({
    model: DECK_AI_MODEL,
    max_tokens: 16000,
    system: SCREENING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
            title: fileName,
          },
          { type: "text", text: DECK_USER_INSTRUCTIONS },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(DeckAnalysisOutputSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new DeckAnalysisError("Claude declined to process this deck.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new DeckAnalysisError("Claude's response was cut off before it finished. Try again.");
  }
  if (!response.parsed_output) {
    throw new DeckAnalysisError("Claude's response didn't match the expected format. Try again.");
  }

  return {
    output: cleanOutput(response.parsed_output),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
