import { describe, expect, it } from "vitest";
import { analyzeDeck, DeckAnalysisError } from "./analyze";
import { fakeAnthropicClient, sampleOutput } from "./mock";
import { DECK_AI_MODEL } from "./prompt";
import { applyHouseStyle, cleanOutput, renderScreen } from "./render";

describe("applyHouseStyle", () => {
  it("replaces em/en dashes and arrows, strips emoji", () => {
    expect(applyHouseStyle("Seed — strong pilot")).toBe("Seed - strong pilot");
    expect(applyHouseStyle("2019–2021")).toBe("2019 - 2021");
    expect(applyHouseStyle("idea → revenue")).toBe("idea to revenue");
    expect(applyHouseStyle("Great team 🚀")).toBe("Great team");
  });
});

describe("renderScreen", () => {
  it("follows the template's required format", () => {
    const text = renderScreen(sampleOutput("Kora Health.pdf").screen);
    expect(text).toMatch(/^ELIGIBILITY SCREEN: Kora Health\n\nOne-line summary: /);
    expect(text).toContain("Recommendation: Need more information");
    expect(text).toContain("Stage fit: Pre-seed - Raising");
    expect(text).toContain("DXV thesis fit: Not stated - ");
    expect(text).toContain("Red flags: None identified");
    expect(text).not.toMatch(/[—→]/);
  });

  it("lists red flags when there are some", () => {
    const s = { ...sampleOutput("x.pdf").screen, redFlags: ["No team information", "Series B raise"] };
    expect(renderScreen(s)).toContain("Red flags: \n- No team information\n- Series B raise");
  });
});

describe("cleanOutput", () => {
  it("cleans nested strings and drops emptied red flags", () => {
    const o = sampleOutput("x.pdf");
    o.screen.teamStrength = "Solid — two founders";
    o.screen.redFlags = ["🚩", "Stage mismatch"];
    const c = cleanOutput(o);
    expect(c.screen.teamStrength).toBe("Solid - two founders");
    expect(c.screen.redFlags).toEqual(["Stage mismatch"]);
  });
});

describe("analyzeDeck", () => {
  it("sends the PDF as a base64 document with the DXV prompt and returns cleaned output", async () => {
    type SentParams = {
      model: string;
      system: string;
      messages: { content: { type: string; source?: unknown }[] }[];
      output_config: { format?: unknown };
    };
    let sent: SentParams | undefined;
    const result = await analyzeDeck(
      fakeAnthropicClient({ onRequest: (p) => (sent = p as SentParams) }),
      Buffer.from("%PDF-1.4 test"),
      "Kora Health.pdf",
    );
    if (!sent) throw new Error("no request sent");
    expect(sent.model).toBe(DECK_AI_MODEL);
    expect(sent.system).toContain("Diversity X Ventures");
    const doc = sent.messages[0].content[0];
    expect(doc.type).toBe("document");
    expect(doc.source).toEqual({ type: "base64", media_type: "application/pdf", data: Buffer.from("%PDF-1.4 test").toString("base64") });
    expect(sent.output_config.format).toBeDefined();
    expect(result.output.extracted.name).toBe("Kora Health");
    expect(result.inputTokens).toBe(1234);
  });

  it("reports refusals, truncation and unparseable output as errors", async () => {
    const pdf = Buffer.from("x");
    await expect(analyzeDeck(fakeAnthropicClient({ stopReason: "refusal" }), pdf, "a.pdf")).rejects.toThrow(DeckAnalysisError);
    await expect(analyzeDeck(fakeAnthropicClient({ stopReason: "max_tokens" }), pdf, "a.pdf")).rejects.toThrow(/cut off/);
    await expect(analyzeDeck(fakeAnthropicClient({ output: null }), pdf, "a.pdf")).rejects.toThrow(/expected format/);
  });
});
