import { describe, expect, it } from "vitest";
import { analyzeDeck } from "./deck-ai/analyze";
import { fakeAnthropicClient } from "./deck-ai/mock";
import { renderContext } from "./memo-ai/context";
import { renderFounderInfo, statedFounderDiversity, type FounderInfo } from "./founder-info";

const app = {
  submittedAt: new Date("2026-10-12T10:00:00Z"),
  pitch: "Cycle-aware fuelling for female athletes",
  sector: "Femtech",
  companyStage: "Pre-Seed",
  raiseAmountGbp: 250_000,
  website: "https://nana.example",
  diversityThemes: ["Female Founder", "Immigrant"],
};

describe("founder info for the AI", () => {
  it("joins the deal's and the application's founder diversity once each, never 'prefer not to say'", () => {
    const info: FounderInfo = {
      founderDiversity: ["female founder", "Neurodiversity"],
      applications: [{ ...app, diversityThemes: ["Female Founder", "Prefer not to say"] }],
    };
    expect(statedFounderDiversity(info)).toEqual(["female founder", "Neurodiversity"]);
  });
  it("gives the founders' own words and says their diversity counts as stated directly", () => {
    const t = renderFounderInfo({ founderDiversity: [], applications: [app] })!;
    expect(t).toContain("Cycle-aware fuelling for female athletes");
    expect(t).toContain("Raising: £250,000");
    expect(t).toContain("Female Founder, Immigrant");
    expect(t).toContain("count as stated directly");
  });
  it("says diversity isn't stated (and not to infer it) when the founders didn't share any", () => {
    expect(renderFounderInfo({ founderDiversity: [], applications: [{ ...app, diversityThemes: [] }] })).toContain("don't infer it");
    expect(renderFounderInfo({ founderDiversity: [], applications: [] })).toBeNull();
    expect(renderFounderInfo({ founderDiversity: ["LGBTQ+"], applications: [] })).toContain("LGBTQ+");
  });
});

describe("the AI jobs receive it", () => {
  it("eligibility screen: sent before the deck", async () => {
    let sent: { messages: { content: { type: string; text?: string }[] }[] } | undefined;
    await analyzeDeck(
      fakeAnthropicClient({ onRequest: (p) => (sent = p as never) }),
      Buffer.from("%PDF"),
      "Nana.pdf",
      null,
      "What the founders told DXV directly: X",
    );
    expect(sent!.messages[0].content.map((c) => c.type)).toEqual(["text", "document", "text"]);
    expect(sent!.messages[0].content[0].text).toContain("What the founders told DXV");
  });
  it("investment assessment: in the DXV OS context", () => {
    const t = renderContext({
      ventureName: "Nana",
      dxvRound: "Round 4",
      details: {},
      eligibilityScreen: null,
      eligibilityDecisions: [],
      founderCommsNotes: [],
      deck: null,
      founderInfo: "Founder diversity, as the founders stated it themselves: Female Founder",
    });
    expect(t).toContain("Female Founder");
  });
});
