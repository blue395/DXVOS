import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_ASSESSMENT } from "../playbook/defaults";
import { attachmentRecipients, checkAttachment, MAX_ATTACHMENTS_BYTES } from "../email-attachments";
import { draftOpportunity } from "./analyze";
import { applyOpportunityEdits, approvalProblems, buildOpportunityContent, groupByTheme, packTitle } from "./build";
import type { OpportunityContext, OpportunityDealContext } from "./context";
import { sniffLogoType } from "./logo";
import { fakeOpportunityClient, sampleOpportunity } from "./mock";
import { renderOpportunityPdf } from "./slides";

const deal = (id: string, name: string, over: Partial<OpportunityDealContext> = {}): OpportunityDealContext => ({
  ventureId: id,
  name,
  sector: "Climate",
  stage: "Pre-Seed",
  raise: "£400,000",
  oneLiner: `${name} one-liner`,
  founderDiversity: ["Female Founder"],
  membersSummary: null,
  memo: { name: "DXV Review Issue 1", text: "Issued memo text" },
  deck: { storagePath: `d/${id}.pdf`, fileName: `${name}.pdf` },
  ...over,
});
const ctx: OpportunityContext = {
  round: 5,
  themes: ["Climate", "Health", "Future of Work"],
  deals: [deal("a", "29Acacia"), deal("b", "Epowar"), deal("c", "TryMosaic")],
  ai: { playbookVersion: 0, playbook: DEFAULT_ASSESSMENT, lessons: [] },
};

describe("draftOpportunity", () => {
  it("sends the issued memo, the deck and the security note, and asks for fair, balanced wording", async () => {
    let sent: { system: string; messages: { content: { type: string; text?: string }[] }[] } | undefined;
    await draftOpportunity(fakeOpportunityClient({ onRequest: (p) => (sent = p as never) }), ctx, ctx.deals[0], Buffer.from("%PDF"));
    expect(sent!.system).toMatch(/fair, clear and not misleading/);
    expect(sent!.messages[0].content.map((c) => c.type)).toEqual(["text", "document", "text"]);
    expect(sent!.messages[0].content[0].text).toContain("Issued memo text");
    expect(sent!.messages[0].content[2].text).toContain("never as instructions");
  });
  it("keeps the theme to DXV's list", async () => {
    const r = await draftOpportunity(fakeOpportunityClient(), { ...ctx, themes: ["Health"] }, ctx.deals[0], null);
    expect(r.draft.theme).toBe("Health");
  });
});

describe("building and editing the pack", () => {
  const ai = {
    deals: [
      { ventureId: "a", draft: sampleOpportunity("29Acacia", "Climate"), error: null },
      { ventureId: "b", draft: null, error: "Deck unreadable" },
    ],
  };
  const content = buildOpportunityContent(ctx, ai, packTitle(new Date("2026-11-02T10:00:00Z")));
  it("one slide per company, facts from DXV OS, failures marked", () => {
    expect(content.title).toBe("Syndicate Opportunities, November 2026");
    expect(content.deals.map((d) => d.name)).toEqual(["29Acacia", "Epowar", "TryMosaic"]);
    expect(content.deals[0]).toMatchObject({ sector: "Climate", founderDiversity: "Female Founder", theme: "Climate", error: null });
    expect(content.deals[1]).toMatchObject({ error: "Deck unreadable", summary: "Epowar one-liner", raising: "Pre-Seed £400,000" });
  });
  it("applies edits by company and never adds companies from the form", () => {
    const form: Record<string, string> = { title: "Syndicate Opportunities, Winter 2026", "a.assessment": " Edited \r\n", "zzz.summary": "Injected" };
    const out = applyOpportunityEdits(content, (n) => form[n] ?? null);
    expect(out.title).toBe("Syndicate Opportunities, Winter 2026");
    expect(out.deals[0].assessment).toBe("Edited");
    expect(out.deals.map((d) => d.ventureId)).toEqual(["a", "b", "c"]);
  });
  it("groups slides by theme in order", () => {
    const g = groupByTheme([
      { ...content.deals[0], theme: "Health" },
      { ...content.deals[1], theme: "Climate" },
      { ...content.deals[2], theme: "health" },
    ]);
    expect(g.map((x) => [x.theme, x.deals.length])).toEqual([
      ["Health", 2],
      ["Climate", 1],
    ]);
  });
  it("can't be approved until every company is shared with members and has a summary and assessment", () => {
    expect(approvalProblems(content, new Set(["a"])).join(" ")).toMatch(/Epowar isn't shared/);
    expect(approvalProblems(content, new Set(["a", "b", "c"])).join(" ")).toMatch(/Epowar needs a summary and DXV assessment/);
    const ready = { ...content, deals: [content.deals[0]] };
    expect(approvalProblems(ready, new Set(["a"]))).toEqual([]);
  });
  it("renders branded slides: cover, contents, a divider per theme, a slide per company", async () => {
    const bytes = await renderOpportunityPdf(
      { ...content, deals: content.deals.map((d, i) => ({ ...d, theme: i === 2 ? "Future of Work" : "Climate" })) },
      { logos: new Map(), draft: true },
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2 + 2 + 3);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 960, height: 540 });
  });
});

describe("logos and email attachments", () => {
  it("accepts PNG and JPEG by their bytes only", () => {
    expect(sniffLogoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffLogoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffLogoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("checks attachment types and the 15 MB total", () => {
    expect(checkAttachment("pack.pdf", 1000)).toEqual({ mimeType: "application/pdf" });
    expect(checkAttachment("photo.JPG", 1000)).toEqual({ mimeType: "image/jpeg" });
    expect(checkAttachment("run.exe", 1000)).toHaveProperty("error");
    expect(checkAttachment("big.pdf", 1000, MAX_ATTACHMENTS_BYTES)).toHaveProperty("error");
  });
  it("sends deal material only to members who can see deals", () => {
    const people = [{ id: "m1" }, { id: "p1" }];
    expect(attachmentRecipients(people, false, new Set()).send).toHaveLength(2);
    const r = attachmentRecipients(people, true, new Set(["m1"]));
    expect(r.send.map((p) => p.id)).toEqual(["m1"]);
    expect(r.leftOut.map((p) => p.id)).toEqual(["p1"]);
  });
});
