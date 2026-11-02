// One company's slide: the deck (if stored) and DXV OS context to Claude, validated.
// Shared with the Netlify worker (relative imports only).
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { withDataNote } from "../ai-untrusted";
import { applyHouseStyle } from "../deck-ai/render";
import { renderOpportunityContext, type OpportunityContext, type OpportunityDealContext } from "./context";
import { buildOpportunityPrompt, OPPORTUNITY_MODEL, OPPORTUNITY_USER_INSTRUCTIONS } from "./prompt";
import { opportunitySchema, OpportunityError, type OpportunityAi } from "./schema";

export type OpportunityResult = { draft: OpportunityAi; model: string; inputTokens: number; outputTokens: number };

export async function draftOpportunity(
  client: Anthropic,
  ctx: OpportunityContext,
  deal: OpportunityDealContext,
  pdf: Buffer | null,
): Promise<OpportunityResult> {
  const response = await client.messages.parse({
    model: OPPORTUNITY_MODEL,
    max_tokens: 4000,
    system: buildOpportunityPrompt(ctx.ai.playbook),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: renderOpportunityContext(ctx, deal) },
          ...(pdf
            ? [
                {
                  type: "document" as const,
                  source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdf.toString("base64") },
                  title: deal.deck?.fileName ?? "deck.pdf",
                },
              ]
            : []),
          { type: "text", text: withDataNote(OPPORTUNITY_USER_INSTRUCTIONS) },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(opportunitySchema) },
  });
  if (response.stop_reason === "refusal") throw new OpportunityError("Claude declined to draft this slide.");
  if (response.stop_reason === "max_tokens") throw new OpportunityError("The slide was cut off before it finished.");
  const out = response.parsed_output;
  if (!out) throw new OpportunityError("The slide didn't match the expected format.");
  const clean = (s: string) => applyHouseStyle(s).trim();
  // The theme must be one of DXV's; anything else falls back to the first.
  const theme = ctx.themes.find((t) => t.toLowerCase() === out.theme.trim().toLowerCase()) ?? ctx.themes[0] ?? "Other";
  const draft = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, clean(String(v))])) as OpportunityAi;
  return { draft: { ...draft, theme }, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
