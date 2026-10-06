// Deck intake: the quick read done when a deck is dropped on the board's Submitted
// column. Only the company name, primary founder and stage are read; the eligibility
// screen runs later, when someone asks for it on the deal page.
//
// Shared with the Netlify worker: no Next-only imports, no "@/" aliases.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { COMPANY_STAGES, normaliseCompanyStage } from "../pipeline";
import { DeckAnalysisError, type DeckAnalysisResult } from "./analyze";
import { DECK_AI_MODEL } from "./prompt";
import type { ExtractedFields } from "./schema";
import { withDataNote } from "../ai-untrusted";

export const IntakeOutputSchema = z.object({
  name: z.string().nullable(),
  primaryFounder: z.string().nullable(),
  companyStage: z.string().nullable(),
});
export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;

export const INTAKE_SYSTEM_PROMPT =
  "You file founder pitch decks for Diversity X Ventures (DXV), a UK angel syndicate. " +
  "Read only what the deck states. Never guess: if something isn't in the deck, return null.";

export const INTAKE_INSTRUCTIONS = [
  "From this pitch deck, return:",
  "- name: the company or organisation name.",
  "- primaryFounder: the full name of the primary founder (the CEO, or the first founder listed).",
  `- companyStage: one of ${COMPANY_STAGES.map((s) => `"${s}"`).join(", ")}, or the stage as written if it is none of these; only if the deck states it.`,
].join("\n");

/** Intake output as the Venture fields it fills (everything else left empty). */
export function intakeToExtracted(o: IntakeOutput): ExtractedFields {
  const clean = (s: string | null) => s?.trim() || null;
  return {
    name: clean(o.name),
    founderNames: clean(o.primaryFounder),
    founderEmail: null,
    website: null,
    sector: null,
    companyStage: normaliseCompanyStage(o.companyStage),
    raiseAmountGbp: null,
    description: null,
  };
}

export async function readDeckIntake(
  client: Anthropic,
  pdf: Buffer,
  fileName: string,
): Promise<Omit<DeckAnalysisResult, "output"> & { extracted: ExtractedFields }> {
  const response = await client.messages.parse({
    model: DECK_AI_MODEL,
    max_tokens: 1000,
    system: INTAKE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") }, title: fileName },
          { type: "text", text: withDataNote(INTAKE_INSTRUCTIONS) },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(IntakeOutputSchema) },
  });
  if (response.stop_reason === "refusal") throw new DeckAnalysisError("Claude declined to read this deck.");
  if (!response.parsed_output) throw new DeckAnalysisError("Claude's response didn't match the expected format. Try again.");
  return {
    extracted: intakeToExtracted(response.parsed_output),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
