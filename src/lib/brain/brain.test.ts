import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { dehydrateDecks, rehydrateDecks } from "../brain-worker";
import { DEFAULT_ASSESSMENT, DEFAULT_ELIGIBILITY } from "../playbook/defaults";
import { fakeBrainCall } from "./mock";
import { chatTitle, dealIdFromPath } from "./page";
import { BRAIN_MODEL, BRAIN_SETUP_VERSION, brainSearchLimit, buildBrainSystem, questionNote, type BrainContext } from "./prompt";
import { brainParams, BrainError, runBrainTurn, type BrainModelCall } from "./run";
import { BRAIN_TOOLS, DECK_MARKER } from "./tools";

type Msg = Anthropic.Beta.BetaMessage;
const ctx: BrainContext = {
  eligibility: { version: 3, playbook: DEFAULT_ELIGIBILITY },
  assessment: { version: 0, playbook: DEFAULT_ASSESSMENT },
  lessons: [{ title: "Check the cap table early", body: "Messy cap tables slowed two deals.", scope: "DUE_DILIGENCE" }],
};
const ask = (text: string): Anthropic.Beta.BetaMessageParam[] => [{ role: "user", content: [{ type: "text", text }] }];
const reply = (content: unknown[], stop: string) =>
  ({ model: "m", content, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 5 } }) as unknown as Msg;

describe("Brain instructions", () => {
  it("carry DXV's Playbook criteria, versions and approved lessons", () => {
    const s = buildBrainSystem(ctx);
    expect(s).toContain("You are the DXV Brain");
    expect(s).toContain("Playbook version 3");
    for (const c of DEFAULT_ELIGIBILITY.criteria) expect(s).toContain(c.name);
    for (const c of DEFAULT_ASSESSMENT.criteria) expect(s).toContain(c.name);
    expect(s).toContain("[due diligence] Check the cap table early");
    expect(s).toContain("never change it");
    expect(buildBrainSystem(ctx)).toBe(s); // stable, so Claude can cache it
  });

  it("keep each chat's setup fixed: older chats keep 5 searches and their exact instructions", () => {
    const v1 = buildBrainSystem(ctx); // chats from before setup versions have no `setup`
    const v2 = buildBrainSystem({ ...ctx, setup: 2 });
    expect(v1).not.toContain("web searches per question");
    expect(v2).toContain("You have up to 12 web searches per question");
    expect(v2).toContain("a follow-up question in this same chat gets a fresh allowance");
    expect(v2.replace(/\n- You have up to 12 web searches[^\n]*/, "")).toBe(v1); // the only difference
    const search = (setup?: number) => (brainParams("s", ask("q"), setup).tools ?? []).find((t) => "name" in t && t.name === "web_search") as { max_uses: number };
    expect(search().max_uses).toBe(5);
    expect(search(2).max_uses).toBe(12);
    expect(BRAIN_SETUP_VERSION).toBe(2);
    expect(brainSearchLimit(BRAIN_SETUP_VERSION)).toBe(12);
  });

  it("note which deal page a question came from", () => {
    const at = new Date("2026-10-02T10:30:00Z");
    expect(questionNote({ askedAt: at, pagePath: "/deals/abc", deal: { id: "abc", name: "Kora", stage: "Due Diligence" } })).toBe(
      "[Asked 2 Oct 2026, 11:30 UK time, from the deal page for Kora (deal id abc, stage Due Diligence).]",
    );
    expect(questionNote({ askedAt: at, pagePath: "/playbook", deal: null })).toContain("from the DXV OS page /playbook");
  });

  it("offer read-only tools only", () => {
    expect(BRAIN_TOOLS.map((t) => t.name).filter((n) => /^(create|update|delete|move|set|record|add)/.test(n))).toEqual([]);
  });
});

describe("page helpers", () => {
  it("find the deal from the path", () => {
    expect(dealIdFromPath("/deals/abc123")).toBe("abc123");
    expect(dealIdFromPath("/deals/abc123/assessment")).toBe("abc123");
    expect(dealIdFromPath("/deals/new")).toBeNull();
    expect(dealIdFromPath("/deals")).toBeNull();
    expect(dealIdFromPath("/")).toBeNull();
  });
  it("title a chat from its first question", () => {
    expect(chatTitle("  What's   in DD?\n")).toBe("What's in DD?");
    expect(chatTitle("x ".repeat(60)).length).toBeLessThanOrEqual(70);
  });
});

describe("runBrainTurn", () => {
  it("looks things up, then answers, keeping every turn for replay", async () => {
    const tools: string[] = [];
    const progress: string[] = [];
    let params: unknown;
    const r = await runBrainTurn({
      call: fakeBrainCall({ onRequest: (p) => (params = p) }),
      system: "sys",
      history: ask("[Asked ... from the deal page for Kora (deal id abc, stage Submitted).]\n\nHow is it going?"),
      runTool: async (name, input) => {
        tools.push(`${name}:${JSON.stringify(input)}`);
        return "# Kora (id abc)\nStage: Submitted";
      },
      onProgress: (p) => progress.push(p.activity ?? p.text),
    });
    expect(tools).toEqual(['get_deal:{"deal":"abc"}']);
    expect(r.appended.map((t) => t.role)).toEqual(["assistant", "user", "assistant"]);
    expect(r.text).toContain("From DXV OS: Kora (id abc)");
    expect(r.sources).toEqual([{ title: "UK angel market (example source)", url: "https://example.com/uk-angel-market" }]);
    expect(progress).toContain("Reading the deal in DXV OS");
    const p = params as { model: string; tools: { name: string }[]; fallbacks: string; system: { cache_control: unknown }[] };
    expect(p.model).toBe(BRAIN_MODEL);
    expect(p.tools.map((t) => t.name)).toContain("web_search");
    expect(p.fallbacks).toBe("default");
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("resumes a paused web search and reports failed lookups to Claude, not the person", async () => {
    const seen: Anthropic.Beta.BetaMessageParam[][] = [];
    const script = [
      reply([{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }], "pause_turn"),
      reply([{ type: "tool_use", id: "t1", name: "get_memo", input: { deal: "zzz" } }], "tool_use"),
      reply([{ type: "text", text: "Done." }], "end_turn"),
    ];
    const call: BrainModelCall = async (params) => {
      seen.push(params.messages);
      return script.shift()!;
    };
    const r = await runBrainTurn({
      call,
      system: "s",
      history: ask("q"),
      runTool: async () => {
        throw new Error("boom");
      },
      onProgress: () => {},
    });
    expect(r.text).toBe("Done.");
    expect(seen[1].at(-1)?.role).toBe("assistant"); // resumed with no extra user turn
    const results = r.appended[2].content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results[0].is_error).toBe(true);
    expect(results[0].content).toContain("boom");
  });

  it("explains a refusal", async () => {
    const call: BrainModelCall = async () => reply([], "refusal");
    await expect(runBrainTurn({ call, system: "s", history: ask("q"), runTool: async () => "", onProgress: () => {} })).rejects.toThrow(BrainError);
  });
});

describe("decks in stored chats", () => {
  it("store a pointer, and replay the same PDF", async () => {
    const pdf = Buffer.from("%PDF-1.4 deck");
    const turns: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: [
              { type: "text", text: "Kora's deck:" },
              { type: "document", title: "Kora.pdf", context: `${DECK_MARKER}:abc/Kora.pdf`, source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
            ],
          },
        ],
      },
    ];
    const stored = await dehydrateDecks(turns);
    expect(JSON.stringify(stored)).not.toContain(pdf.toString("base64"));
    const paths: string[] = [];
    const replayed = await rehydrateDecks(stored, async (p) => {
      paths.push(p);
      return pdf;
    });
    expect(paths).toEqual(["abc/Kora.pdf"]);
    expect(replayed).toEqual(turns);
  });
});
