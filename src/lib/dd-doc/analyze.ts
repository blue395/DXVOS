// Sends the deck (if stored) + DXV OS context to Claude; returns a validated, house-styled DD plan.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { applyHouseStyle } from "../deck-ai/render";
import { renderDDContext, type DDContext } from "./context";
import { DD_AI_MODEL, DD_SYSTEM_PROMPT, DD_USER_INSTRUCTIONS } from "./prompt";
import { DDPlanError, DDPlanSchema, normaliseAreas, type DDPlan } from "./schema";
import { withDataNote } from "../ai-untrusted";

export type DDPlanResult = { plan: DDPlan; model: string; inputTokens: number; outputTokens: number };

/** House style on every string, recursively; empty list items dropped. */
export function cleanPlan(p: DDPlan): DDPlan {
  const clean = (v: unknown): unknown =>
    typeof v === "string"
      ? applyHouseStyle(v)
      : Array.isArray(v)
        ? v.map(clean).filter((x) => x !== "")
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]))
          : v;
  return clean(p) as DDPlan;
}

export async function analyzeDD(client: Anthropic, pdf: Buffer | null, context: DDContext): Promise<DDPlanResult> {
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: renderDDContext(context) }];
  if (pdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
      title: context.deck?.fileName ?? "deck.pdf",
    });
  }
  content.push({ type: "text", text: withDataNote(DD_USER_INSTRUCTIONS) });

  const response = await client.messages.parse({
    model: DD_AI_MODEL,
    max_tokens: 16000,
    system: DD_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(DDPlanSchema) },
  });

  if (response.stop_reason === "refusal") throw new DDPlanError("Claude declined to draft this DD plan.");
  if (response.stop_reason === "max_tokens") throw new DDPlanError("The DD plan was cut off before it finished. Try again.");
  if (!response.parsed_output) throw new DDPlanError("The DD plan didn't match the expected format. Try again.");

  const plan = cleanPlan(response.parsed_output);
  plan.areas = normaliseAreas(plan.areas);
  return { plan, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
