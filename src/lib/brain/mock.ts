// A stand-in for Claude, for tests and local development (DECK_AI_MOCK=true, never in
// production). It looks something up with a DXV OS tool, then streams a short answer
// that quotes the lookup and cites a (fake) web source, so the whole loop is exercised.
import type Anthropic from "@anthropic-ai/sdk";
import type { BrainModelCall, BrainParams } from "./run";

type Block = Anthropic.Beta.BetaContentBlock;

function message(content: Block[], stop: Anthropic.Beta.BetaStopReason): Anthropic.Beta.BetaMessage {
  return {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: "mock-brain",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 900, output_tokens: 120 },
  } as unknown as Anthropic.Beta.BetaMessage;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fakeBrainCall(opts: { onRequest?: (p: BrainParams) => void } = {}): BrainModelCall {
  return async (params, on) => {
    opts.onRequest?.(params);
    const step = Number(process.env.DECK_AI_MOCK_DELAY_MS ?? 0) / 40;
    const last = params.messages[params.messages.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: "text" as const, text: last.content }];
    const toolResult = blocks.find((b) => b.type === "tool_result");

    if (!toolResult) {
      // A new question: look it up in DXV OS first.
      const note = blocks.map((b) => (b.type === "text" ? b.text : "")).join(" ");
      const dealId = note.match(/deal id ([\w-]+)/)?.[1];
      const [name, input] = dealId ? ["get_deal", { deal: dealId }] : ["pipeline_overview", {}];
      on.onBlock(name);
      if (step) await delay(step * 10);
      return message([{ type: "tool_use", id: `toolu_mock_${params.messages.length}`, name, input } as Block], "tool_use");
    }

    const result = typeof toolResult.content === "string" ? toolResult.content : (toolResult.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
    const firstLine = result.split("\n").find((l) => l.trim()) ?? "nothing";
    const answer = `**Mock DXV Brain answer.** From DXV OS: ${firstLine.replace(/^#\s*/, "")}\n\n- This is a stand-in reply (DECK_AI_MOCK=true).\n- Market context would come from the web, cited below.`;
    for (const word of answer.split(/(?<= )/)) {
      on.onText(word);
      if (step) await delay(step);
    }
    return message(
      [
        {
          type: "text",
          text: answer,
          citations: [{ type: "web_search_result_location", url: "https://example.com/uk-angel-market", title: "UK angel market (example source)", cited_text: "", encrypted_index: "" }],
        } as Block,
      ],
      "end_turn",
    );
  };
}
