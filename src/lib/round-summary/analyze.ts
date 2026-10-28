// One deal's summary: the deck (if stored) and the DXV OS context to Claude, validated.
// Pure apart from the API call; shared with the Netlify worker (relative imports only).
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { withDataNote } from "../ai-untrusted";
import { applyHouseStyle } from "../deck-ai/render";
import { renderDealContext, type RoundSummaryContext, type SummaryDealContext } from "./context";
import { buildSummaryPrompt, ROUND_SUMMARY_MODEL, SUMMARY_USER_INSTRUCTIONS } from "./prompt";
import { dealSummarySchema, RoundSummaryError, type DealSummaryAi } from "./schema";

export type DealSummaryResult = { summary: DealSummaryAi; model: string; inputTokens: number; outputTokens: number };

const clean = (s: string) => applyHouseStyle(s).trim();
const cleanList = (xs: string[], max: number) => xs.map(clean).filter(Boolean).slice(0, max);

export async function summariseDeal(client: Anthropic, ctx: RoundSummaryContext, deal: SummaryDealContext, pdf: Buffer | null): Promise<DealSummaryResult> {
  const response = await client.messages.parse({
    model: ROUND_SUMMARY_MODEL,
    max_tokens: 4000,
    system: buildSummaryPrompt(ctx.ai.playbook, ctx.ai.lessons),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: renderDealContext(ctx.round, deal) },
          ...(pdf
            ? [
                {
                  type: "document" as const,
                  source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdf.toString("base64") },
                  title: deal.deck?.fileName ?? "deck.pdf",
                },
              ]
            : []),
          { type: "text", text: withDataNote(SUMMARY_USER_INSTRUCTIONS) },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(dealSummarySchema) },
  });
  if (response.stop_reason === "refusal") throw new RoundSummaryError("Claude declined to summarise this deck.");
  if (response.stop_reason === "max_tokens") throw new RoundSummaryError("The summary was cut off before it finished.");
  const out = response.parsed_output;
  if (!out) throw new RoundSummaryError("The summary didn't match the expected format.");
  const summary: DealSummaryAi = {
    headline: clean(out.headline),
    dealTerms: clean(out.dealTerms) || "Not stated",
    strengths: cleanList(out.strengths, 3),
    concerns: cleanList(out.concerns, 3),
    dxvFit: clean(out.dxvFit),
    impactThemes: cleanList(out.impactThemes, 6),
    diversityThemes: cleanList(out.diversityThemes, 6).filter((t) => !/^(not stated|none|n\/a|unknown)$/i.test(t)),
    keyQuestion: clean(out.keyQuestion),
  };
  return { summary, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
