// Sends one deck to Claude and returns validated, house-styled output.
// The Anthropic client is passed in so tests can substitute a fake one.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DEFAULT_ELIGIBILITY } from "../playbook/defaults";
import { buildDeckUserInstructions, buildScreeningPrompt } from "../playbook/prompts";
import type { AiContextSnapshot, EligibilityPlaybook } from "../playbook/schema";
import { normaliseCompanyStage } from "../pipeline";
import { DECK_AI_MODEL } from "./prompt";
import { DeckAnalysisOutputSchema, type DeckAnalysisOutput } from "./schema";
import { cleanOutput } from "./render";

export class DeckAnalysisError extends Error {}

export type DeckAnalysisResult = {
  output: DeckAnalysisOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** `ai`: the Playbook version and lessons snapshotted when the job was created (null: built-in defaults). */
export async function analyzeDeck(
  client: Anthropic,
  pdf: Buffer,
  fileName: string,
  ai?: AiContextSnapshot<EligibilityPlaybook> | null,
): Promise<DeckAnalysisResult> {
  const playbook = ai?.playbook ?? DEFAULT_ELIGIBILITY;
  const response = await client.messages.parse({
    model: DECK_AI_MODEL,
    max_tokens: 16000,
    system: buildScreeningPrompt(playbook, ai?.lessons ?? []),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
            title: fileName,
          },
          { type: "text", text: buildDeckUserInstructions(playbook) },
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

  const output = cleanOutput(response.parsed_output);
  output.extracted.companyStage = normaliseCompanyStage(output.extracted.companyStage); // onto DXV's stage options
  return {
    output,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
