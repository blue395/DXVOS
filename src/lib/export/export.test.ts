import JSZip from "jszip"; // (ships with docx)
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { ddSpec } from "../dd-doc/build";
import type { DDContext } from "../dd-doc/context";
import { samplePlan } from "../dd-doc/mock";
import { sampleMemo } from "../memo-ai/mock";
import { memoSpec, screenSpec } from "./documents";
import { renderDocx } from "./docx";
import { renderPdf } from "./pdf";
import { exportFileName } from "./spec";

const screen = {
  companyName: "Kora Health",
  oneLineSummary: "Repeat-prescription software for independent pharmacies → fewer errors ✓ 🚀",
  recommendation: "Proceed to pipeline" as const,
  stageFit: { rating: "Pre-seed" as const, reasoning: "Raising £250k pre-seed." },
  sector: { name: "Healthtech", note: "No concern." },
  teamStrength: "Two co-founders.",
  thesisFit: { rating: "Not stated" as const, reasoning: "The deck does not state founder backgrounds." },
  redFlags: [],
  nextStep: "Confirm founder background.",
  otherCriteria: [{ criterion: "UK company", assessment: "Met: registered in England." }],
};
const ctx: DDContext = {
  ventureName: "Kora Health",
  details: [{ label: "Sector", value: "Healthtech" }],
  memo: null,
  eligibilityScreen: null,
  ddItems: [],
  deck: null,
  preparedBy: "Blue",
};
const date = new Date("2026-09-29T10:00:00Z");

const specs = {
  screen: screenSpec(screen, { ventureName: "Kora Health", fileName: "kora.pdf", model: "m", screenedAt: date, decisions: ["Proceed to pipeline (Blue)"] }),
  memo: memoSpec(sampleMemo("Kora Health"), { name: "DXV Review Issue 1", ventureName: "Kora Health", banner: false, footer: "Issued by Blue.", date }),
  aiDraft: memoSpec(sampleMemo("Kora Health"), { name: "AI Draft 1", ventureName: "Kora Health", banner: true, date }),
  dd: ddSpec(ctx, samplePlan(), date),
};

describe("exports", () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(`renders the ${name} as a valid PDF`, async () => {
      const bytes = await renderPdf(spec);
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      expect(pdf.getTitle()).toContain("Kora Health");
    });

    it(`renders the ${name} as a Word document`, async () => {
      const xml = await (await JSZip.loadAsync(await renderDocx(spec))).file("word/document.xml")!.async("string");
      expect(xml).toContain(spec.title);
      expect(xml).toContain("Kora Health");
    });
  }

  it("long documents flow onto several pages", async () => {
    const pdf = await PDFDocument.load(await renderPdf(specs.dd));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });

  it("puts the review banner on drafts only", () => {
    expect(specs.aiDraft.notice).toMatch(/AI-assisted first pass/);
    expect(specs.memo.notice).toBeUndefined();
  });

  it("names files by document, venture and date", () => {
    expect(exportFileName("DXV Review Issue 2", "Papcup / Ltd.", date, "pdf")).toBe("DXV Review Issue 2 - Papcup Ltd - 2026-09-29.pdf");
  });
});
