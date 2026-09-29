// One DXV Brain reply: stream Claude's answer, run the read-only DXV OS tools it asks
// for, resume after web searches, and report progress as it goes. The model call is
// passed in, so tests (and local development) can use a fake.
//
// Shared with the Netlify worker: relative imports only.
import type Anthropic from "@anthropic-ai/sdk";
import { BRAIN_MODEL, brainSearchLimit } from "./prompt";
import { BRAIN_TOOLS, BrainToolError, toolActivity, webSearchTool } from "./tools";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type Message = Anthropic.Beta.BetaMessage;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
export type BrainParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** One call to Claude. `onText` gets answer text as it streams; `onBlock` names each tool as it starts. */
export type BrainModelCall = (params: BrainParams, on: { onText: (delta: string) => void; onBlock: (toolName: string) => void }) => Promise<Message>;

export class BrainError extends Error {}

export type BrainSource = { title: string; url: string };

export type BrainReply = {
  /** The turns this reply added to the conversation (assistant, tool results, ...), replayed unchanged next time. */
  appended: MessageParam[];
  text: string;
  sources: BrainSource[];
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** Tool rounds per reply before the Brain must answer with what it has. */
export const MAX_STEPS = 10;

/** `setup`: the chat's BRAIN_SETUP_VERSION (tools must stay identical for the whole chat). */
export function brainParams(system: string, messages: MessageParam[], setup = 1): BrainParams {
  return {
    model: BRAIN_MODEL,
    max_tokens: 32000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], // same all chat: cached
    cache_control: { type: "ephemeral" }, // and the conversation so far
    messages,
    tools: [...BRAIN_TOOLS, webSearchTool(brainSearchLimit(setup))],
    output_config: { effort: "medium" },
    // If Claude's safety filters decline (e.g. a false positive on a biotech deck), the API
    // retries on the model Anthropic designates, within the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
}

const textOf = (m: Message) =>
  m.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

function sourcesOf(m: Message): BrainSource[] {
  const out: BrainSource[] = [];
  for (const b of m.content) {
    if (b.type !== "text" || !b.citations) continue;
    for (const c of b.citations) if (c.type === "web_search_result_location") out.push({ title: c.title || c.url, url: c.url });
  }
  return out;
}

export async function runBrainTurn(opts: {
  call: BrainModelCall;
  system: string;
  setup?: number; // the chat's setup version (BrainContext.setup)
  history: MessageParam[]; // the conversation so far, ending with the new question
  runTool: (name: string, input: Record<string, unknown>) => Promise<ToolResult["content"]>;
  onProgress: (p: { text: string; activity: string | null }) => void;
}): Promise<BrainReply> {
  const appended: MessageParam[] = [];
  const done: string[] = []; // answer text from finished calls
  const sources = new Map<string, BrainSource>();
  let model: string = BRAIN_MODEL;
  let inputTokens = 0;
  let outputTokens = 0;

  const shown = (live = "") => [...done, live.trim()].filter(Boolean).join("\n\n");

  for (let step = 0; step < MAX_STEPS; step++) {
    let live = "";
    const message = await opts.call(brainParams(opts.system, [...opts.history, ...appended], opts.setup), {
      onText: (delta) => {
        live += delta;
        opts.onProgress({ text: shown(live), activity: null });
      },
      onBlock: (name) => opts.onProgress({ text: shown(live), activity: toolActivity(name) }),
    });

    model = message.model;
    inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    outputTokens += message.usage.output_tokens;
    appended.push({ role: "assistant", content: message.content });
    const text = textOf(message);
    if (text) done.push(text);
    for (const s of sourcesOf(message)) sources.set(s.url, s);

    if (message.stop_reason === "refusal") {
      throw new BrainError("Claude declined to answer that. Try rephrasing the question.");
    }
    if (message.stop_reason === "pause_turn") continue; // a long web search: the API resumes where it left off
    if (message.stop_reason !== "tool_use") break; // end_turn (or max_tokens: keep what it wrote)

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    opts.onProgress({ text: shown(), activity: toolActivity(calls[0]?.name ?? "") });
    // All results go back in one message (so Claude keeps making parallel calls).
    const results: ToolResult[] = await Promise.all(
      calls.map(async (c): Promise<ToolResult> => {
        try {
          return { type: "tool_result", tool_use_id: c.id, content: await opts.runTool(c.name, (c.input ?? {}) as Record<string, unknown>) };
        } catch (e) {
          const msg = e instanceof BrainToolError ? e.message : `The lookup failed: ${e instanceof Error ? e.message : "unknown error"}`;
          if (!(e instanceof BrainToolError)) console.error(`Brain tool ${c.name} failed:`, e);
          return { type: "tool_result", tool_use_id: c.id, content: msg, is_error: true };
        }
      }),
    );
    appended.push({ role: "user", content: results });
    if (step === MAX_STEPS - 1) done.push("(I stopped after several lookups. Ask a narrower question if something is missing.)");
  }

  const text = shown();
  if (!text) throw new BrainError("The Brain didn't produce an answer. Try again.");
  return { appended, text, sources: [...sources.values()], model, inputTokens, outputTokens };
}
