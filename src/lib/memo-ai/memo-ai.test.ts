import { describe, expect, it } from "vitest";
import { analyzeMemo } from "./analyze";
import type { MemoContext } from "./context";
import { fakeMemoClient, sampleMemo } from "./mock";
import { MEMO_AI_MODEL } from "./prompt";
import { REVIEW_BANNER, renderMemo } from "./render";
import { CRITERIA, MemoFormatError, normaliseScores, totalScore } from "./schema";

const context: MemoContext = {
  ventureName: "Kora Health",
  dxvRound: "Round 3",
  details: { Sector: "Healthtech", "Raise (£)": "400000" },
  eligibilityScreen: "ELIGIBILITY SCREEN: Kora Health\n\nRecommendation: Proceed to pipeline",
  eligibilityDecisions: ["Proceed (Blue): strong pharmacy pilot"],
  founderCommsNotes: [],
  deck: { storagePath: "a/kora.pdf", fileName: "kora.pdf" },
};

describe("normaliseScores", () => {
  it("orders scores by the template and rejects gaps or duplicates", () => {
    const scores = sampleMemo().scores;
    expect(normaliseScores([...scores].reverse()).map((s) => s.criterion)).toEqual([...CRITERIA]);
    expect(() => normaliseScores(scores.slice(1))).toThrow(MemoFormatError);
    expect(() => normaliseScores([...scores, scores[0]])).toThrow(/twice/);
  });

  it("totals scores out of 55", () => {
    expect(totalScore(sampleMemo().scores)).toBe(32);
  });
});

describe("renderMemo", () => {
  it("opens with the review banner on drafts, in template order", () => {
    const text = renderMemo(sampleMemo("Kora Health"), { banner: true });
    expect(text.startsWith(REVIEW_BANNER[0])).toBe(true);
    const order = ["Business name:", "EXECUTIVE SUMMARY", "INVESTMENT CASE", "CONCLUSION", "SCORING (32/55)", "SWOT SUMMARY", "KEY FOLLOW-UP QUESTIONS"];
    const positions = order.map((h) => text.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).toContain("Diversity themes: Not stated");
  });

  it("omits the banner once finalised", () => {
    expect(renderMemo(sampleMemo(), { banner: false, footer: "Reviewed by Blue" })).not.toContain("DRAFT");
  });
});

describe("analyzeMemo", () => {
  it("sends context, deck and instructions; overrides the round; cleans house style", async () => {
    let sent: { model: string; system: string; messages: { content: { type: string; text?: string }[] }[] } | undefined;
    const memo = sampleMemo("Kora Health");
    memo.executiveSummary = "Strong pilot — great team 🚀";
    memo.header.round = "Series B"; // model got it wrong
    const result = await analyzeMemo(fakeMemoClient({ memo, onRequest: (p) => (sent = p as typeof sent) }), Buffer.from("%PDF"), context);
    if (!sent) throw new Error("no request");
    expect(sent.model).toBe(MEMO_AI_MODEL);
    expect(sent.system).toContain("Scoring anchors");
    expect(sent.messages[0].content.map((b) => b.type)).toEqual(["text", "document", "text"]);
    expect(sent.messages[0].content[0].text).toContain("Recommendation: Proceed to pipeline");
    expect(result.memo.header.round).toBe("Round 3");
    expect(result.memo.executiveSummary).toBe("Strong pilot - great team");
  });

  it("reports refusals, truncation and incomplete scoring", async () => {
    const pdf = Buffer.from("x");
    await expect(analyzeMemo(fakeMemoClient({ stopReason: "refusal" }), pdf, context)).rejects.toThrow(MemoFormatError);
    await expect(analyzeMemo(fakeMemoClient({ stopReason: "max_tokens" }), pdf, context)).rejects.toThrow(/cut off/);
    const partial = sampleMemo();
    partial.scores = partial.scores.slice(0, 5);
    await expect(analyzeMemo(fakeMemoClient({ memo: partial }), pdf, context)).rejects.toThrow(/didn't score/);
  });
});
