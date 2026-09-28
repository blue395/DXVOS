import JSZip from "jszip"; // (ships with docx)
import { describe, expect, it } from "vitest";
import { analyzeDD } from "./analyze";
import { buildDDDocx, ddFileName } from "./build";
import type { DDContext } from "./context";
import { fakeDDClient, samplePlan } from "./mock";
import { DD_AI_MODEL, DD_AREAS } from "./prompt";
import { DDPlanError, normaliseAreas } from "./schema";

const ctx: DDContext = {
  ventureName: "Kora Health",
  details: [
    { label: "Sector", value: "Healthtech" },
    { label: "Website", value: "" },
  ],
  memo: { name: "DXV Review Issue 1", text: "EXECUTIVE SUMMARY\nPharmacy software." },
  eligibilityScreen: "Recommendation: Proceed to pipeline",
  ddItems: ["Cap table review (owner: Anna)"],
  deck: { bucket: "decks", storagePath: "a/kora.pdf", fileName: "kora.pdf" },
  preparedBy: "Blue",
};

describe("normaliseAreas", () => {
  it("puts areas in report order and rejects a missing area", () => {
    const areas = samplePlan().areas;
    expect(normaliseAreas([...areas].reverse()).map((a) => a.area)).toEqual([...DD_AREAS]);
    expect(() => normaliseAreas(areas.slice(1))).toThrow(DDPlanError);
  });
});

describe("analyzeDD", () => {
  it("sends the context, the deck and the model; cleans house style", async () => {
    let sent: { model: string; messages: { content: { type: string; text?: string }[] }[] } | undefined;
    const plan = samplePlan();
    plan.scope = "Check traction — then IP → S/EIS";
    const r = await analyzeDD(fakeDDClient({ plan, onRequest: (p) => (sent = p as typeof sent) }), Buffer.from("%PDF"), ctx);
    expect(sent!.model).toBe(DD_AI_MODEL);
    expect(sent!.messages[0].content.map((c) => c.type)).toEqual(["text", "document", "text"]);
    expect(sent!.messages[0].content[0].text).toContain("DXV Review Issue 1");
    expect(r.plan.scope).not.toMatch(/[—→]/);
  });

  it("works without a deck", async () => {
    let types: string[] = [];
    await analyzeDD(fakeDDClient({ onRequest: (p) => (types = (p as { messages: { content: { type: string }[] }[] }).messages[0].content.map((c) => c.type)) }), null, ctx);
    expect(types).toEqual(["text", "text"]);
  });

  it("reports refusals, truncation and bad output", async () => {
    await expect(analyzeDD(fakeDDClient({ stopReason: "refusal" }), null, ctx)).rejects.toThrow(/declined/);
    await expect(analyzeDD(fakeDDClient({ stopReason: "max_tokens" }), null, ctx)).rejects.toThrow(/cut off/);
    await expect(analyzeDD(fakeDDClient({ plan: null }), null, ctx)).rejects.toThrow(DDPlanError);
  });
});

describe("buildDDDocx", () => {
  it("produces a Word file with the cover, every area and the sign-off", async () => {
    const buf = await buildDDDocx(ctx, samplePlan(), new Date("2026-09-28T12:00:00Z"));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const text of ["Due Diligence Report", "Kora Health", "DRAFT: AI-assisted first pass", "Priority risks", ...DD_AREAS, "Documents requested", "Sign-off", "TBC"]) {
      expect(xml).toContain(text.replace(/&/g, "&amp;"));
    }
    expect(xml).toContain("28 September 2026");
  });

  it("names the file after the venture and date", () => {
    expect(ddFileName("Kora Health / Ltd.", new Date("2026-09-28T12:00:00Z"))).toBe("DXV DD Report - Kora Health Ltd - 2026-09-28.docx");
    expect(ddFileName("!!!", new Date("2026-09-28T12:00:00Z"))).toBe("DXV DD Report - Venture - 2026-09-28.docx");
  });
});
