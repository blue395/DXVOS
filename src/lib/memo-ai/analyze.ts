// Sends the deck + DXV OS context to Claude; returns a validated, house-styled memo.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { applyHouseStyle } from "../deck-ai/render";
import { renderContext, type MemoContext } from "./context";
import { MEMO_AI_MODEL, MEMO_SYSTEM_PROMPT, MEMO_USER_INSTRUCTIONS } from "./prompt";
import { MemoContentSchema, MemoFormatError, normaliseScores, type MemoContent } from "./schema";

export type MemoAnalysisResult = { memo: MemoContent; model: string; inputTokens: number; outputTokens: number };

/** House style on every string, recursively (the prompt asks; this makes it certain). */
export function cleanMemo(m: MemoContent): MemoContent {
  const clean = (v: unknown): unknown =>
    typeof v === "string"
      ? applyHouseStyle(v)
      : Array.isArray(v)
        ? v.map(clean).filter((x) => x !== "")
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]))
          : v;
  return clean(m) as MemoContent;
}

export async function analyzeMemo(client: Anthropic, pdf: Buffer, context: MemoContext): Promise<MemoAnalysisResult> {
  const response = await client.messages.parse({
    model: MEMO_AI_MODEL,
    max_tokens: 16000,
    system: MEMO_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: renderContext(context) },
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
            title: context.deck?.fileName ?? "deck.pdf",
          },
          { type: "text", text: MEMO_USER_INSTRUCTIONS },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(MemoContentSchema) },
  });

  if (response.stop_reason === "refusal") throw new MemoFormatError("Claude declined to assess this deck.");
  if (response.stop_reason === "max_tokens") throw new MemoFormatError("The memo was cut off before it finished. Try again.");
  if (!response.parsed_output) throw new MemoFormatError("The memo didn't match the expected format. Try again.");

  const memo = cleanMemo(response.parsed_output);
  memo.scores = normaliseScores(memo.scores);
  memo.header.round = context.dxvRound; // app-owned field: never trust the model to copy it
  return { memo, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
