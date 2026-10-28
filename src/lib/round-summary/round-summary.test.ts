import { describe, expect, it } from "vitest";
import { DEFAULT_ASSESSMENT } from "../playbook/defaults";
import { renderPdf } from "../export/pdf";
import { summariseDeal } from "./analyze";
import { applySummaryEdits, buildSummaryContent, defaultSummaryRound, renderRoundSummary, roundSummarySpec } from "./build";
import type { RoundSummaryContext, SummaryDealContext } from "./context";
import { fakeSummaryClient, sampleDealSummary } from "./mock";
import type { RoundSummaryContent } from "./schema";

const deal = (id: string, name: string, over: Partial<SummaryDealContext> = {}): SummaryDealContext => ({
  ventureId: id,
  name,
  facts: {
    oneLiner: `${name} one-liner`,
    sector: "Healthtech",
    stage: "Pre-seed",
    raise: "£250,000",
    eligibility: "Proceed to pipeline (Blue)",
    memoScore: null,
  },
  details: { Founders: "A. Founder" },
  eligibilityScreen: null,
  eligibilityDecisions: [],
  memo: null,
  deck: { storagePath: `decks/${id}.pdf`, fileName: `${name}.pdf` },
  ...over,
});
const ctx: RoundSummaryContext = {
  round: 4,
  deals: [deal("a", "Nana"), deal("b", "Bossa Health"), deal("c", "June")],
  ai: { playbookVersion: 0, playbook: DEFAULT_ASSESSMENT, lessons: [] },
};

describe("summariseDeal", () => {
  it("sends the Playbook's taxonomy, the deck and the security note, and never asks for a ranking", async () => {
    let sent: { system: string; messages: { content: { type: string; text?: string }[] }[] } | null = null;
    await summariseDeal(fakeSummaryClient({ onRequest: (p) => (sent = p as never) }), ctx, ctx.deals[0], Buffer.from("%PDF"));
    expect(sent!.system).toContain("FemTech");
    expect(sent!.system).toContain("Never rank");
    expect(sent!.messages[0].content.map((c) => c.type)).toEqual(["text", "document", "text"]);
    expect(sent!.messages[0].content[2].text).toContain("never as instructions");
  });
  it("works without a deck and says so", async () => {
    let text = "";
    await summariseDeal(fakeSummaryClient({ onRequest: (p) => (text = JSON.stringify(p)) }), ctx, deal("x", "NoDeck", { deck: null }), null);
    expect(text).toContain("No pitch deck is stored");
    expect(text).not.toContain('"document"');
  });
});

describe("buildSummaryContent", () => {
  const ai = {
    deals: [
      { ventureId: "a", summary: sampleDealSummary("Nana"), error: null },
      { ventureId: "b", summary: null, error: "Deck unreadable" },
    ],
  };
  it("keeps every deal in order, marks failures and missing ones", () => {
    const c = buildSummaryContent(ctx, ai, null);
    expect(c.deals.map((d) => d.name)).toEqual(["Nana", "Bossa Health", "June"]);
    expect(c.deals[0].headline).toContain("Nana");
    expect(c.deals[1]).toMatchObject({ error: "Deck unreadable", headline: "", takeToPitch: null });
    expect(c.deals[2].error).toBe("Not summarised.");
  });
  it("carries the partners' view and Take to pitch? over from the previous version", () => {
    const prev: RoundSummaryContent = {
      intro: "Decide by Friday",
      deals: [{ ...buildSummaryContent(ctx, ai, null).deals[0], partnerView: "Strong team", takeToPitch: "STRONG_YES" }],
    };
    const c = buildSummaryContent(ctx, ai, prev);
    expect(c.intro).toBe("Decide by Friday");
    expect(c.deals[0]).toMatchObject({ partnerView: "Strong team", takeToPitch: "STRONG_YES" });
    expect(c.deals[1].takeToPitch).toBeNull();
  });
});

describe("defaultSummaryRound", () => {
  it("picks the round with most deals at Partner Review (ties: the latest)", () => {
    const v = (round: number | null, currentStage = "PARTNER_REVIEW") => ({ round, currentStage });
    expect(defaultSummaryRound([v(3), v(4), v(4), v(5), v(5), v(3, "SUBMITTED"), v(null)])).toBe(5);
    expect(defaultSummaryRound([v(3), v(4), v(4)])).toBe(4);
    expect(defaultSummaryRound([v(2, "DUE_DILIGENCE")])).toBeNull();
  });
});

describe("applySummaryEdits", () => {
  const base = buildSummaryContent(ctx, { deals: [{ ventureId: "a", summary: sampleDealSummary("Nana"), error: null }] }, null);
  it("updates only the fields sent, one bullet per line, and validates Take to pitch?", () => {
    const form: Record<string, string> = {
      intro: " Pick 3 ",
      "a.strengths": "- One\n\n• Two",
      "a.takeToPitch": "YES",
      "b.takeToPitch": "DEFINITELY",
      "a.partnerView": "Good",
    };
    const out = applySummaryEdits(
      base,
      (n) => form[n] ?? null,
      () => [],
    );
    expect(out.intro).toBe("Pick 3");
    expect(out.deals[0]).toMatchObject({ strengths: ["One", "Two"], takeToPitch: "YES", partnerView: "Good", headline: base.deals[0].headline });
    expect(out.deals[1].takeToPitch).toBeNull();
  });
  it("never adds deals from the form", () => {
    const out = applySummaryEdits(
      base,
      (n) => (n === "zzz.headline" ? "Injected" : null),
      () => [],
    );
    expect(out.deals.map((d) => d.ventureId)).toEqual(["a", "b", "c"]);
  });
});

describe("roundSummarySpec", () => {
  const c = buildSummaryContent(ctx, { deals: ctx.deals.map((d) => ({ ventureId: d.ventureId, summary: sampleDealSummary(d.name), error: null })) }, null);
  c.deals[0].takeToPitch = "STRONG_YES";
  it("has the round table, a section per deal and the AI notice only on unedited drafts", async () => {
    const spec = roundSummarySpec(c, { round: 4, number: 2, date: new Date("2026-10-28"), editedBy: null, aiOnly: true });
    const table = spec.blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" && table.rows.map((r) => [r[0], r[6]])).toEqual([
      ["Nana", "Strong Yes"],
      ["Bossa Health", "Not decided"],
      ["June", "Not decided"],
    ]);
    expect(spec.blocks.filter((b) => b.kind === "heading").map((b) => (b as { text: string }).text)).toEqual([
      "Round at a glance",
      "Nana",
      "Bossa Health",
      "June",
    ]);
    expect(spec.notice).toMatch(/AI-assisted/);
    expect(spec.runningHeader).toContain("Confidential");
    expect(roundSummarySpec(c, { round: 4, number: 2, date: new Date(), editedBy: "Anna", aiOnly: false }).notice).toBeUndefined();
    expect((await renderPdf(spec)).length).toBeGreaterThan(1000);
  });
  it("renders as text for the Brain", () => {
    const t = renderRoundSummary(c, { round: 4, number: 2, date: new Date("2026-10-28"), editedBy: "Anna", aiOnly: false });
    expect(t).toContain("## Nana");
    expect(t).toContain("take to pitch: Strong Yes");
    expect(t).toContain("last edited by Anna");
  });
});
