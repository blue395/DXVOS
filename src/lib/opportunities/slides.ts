// The opportunities pack as branded 16:9 slides (PDF), in the style of DXV's monthly
// "Syndicate Opportunities" deck: DXV green background, yellow headings, white text, the
// company's logo top right. Standard fonts only (Windows-1252), like the other exports.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { makeSafe, wrap, type Fonts } from "../export/pdf";
import { groupByTheme } from "./build";
import type { OpportunityContent, OpportunityDeal } from "./schema";

const W = 960;
const H = 540;
const GREEN = rgb(0x1a / 255, 0x3c / 255, 0x35 / 255);
const YELLOW = rgb(0xfb / 255, 0xe4 / 255, 0x5b / 255);
const WHITE = rgb(1, 1, 1);
const SOFT = rgb(0.82, 0.86, 0.84); // white at ~80% on green
const M = 44;

/** App-rendered on every slide (Kevin to check the wording). */
export const RISK_WARNING =
  "Confidential: for DXV's certified members only. Investing in early-stage companies is high risk: you could lose all the money you invest, and you may not be able to sell your shares. DXV does not give investment, tax or legal advice.";

export type SlideLogo = { mimeType: string; data: Uint8Array };

type Ctx = { pdf: PDFDocument; f: Fonts; safe: (s: string) => string; draft: boolean };

function newPage(c: Ctx): PDFPage {
  const page = c.pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: GREEN });
  if (c.draft) {
    page.drawText(c.safe("DRAFT: not approved for members"), {
      x: W - M - c.f.bold.widthOfTextAtSize("DRAFT: not approved for members", 9),
      y: H - 18,
      size: 9,
      font: c.f.bold,
      color: YELLOW,
    });
  }
  return page;
}

/** Brand line and risk warning; `width` narrows them (the cover's green half). */
function footer(c: Ctx, page: PDFPage, width = W - 2 * M) {
  const brand = "Diversity X Ventures";
  page.drawText(brand, { x: M + (width - c.f.bold.widthOfTextAtSize(brand, 11)) / 2, y: 34, size: 11, font: c.f.bold, color: YELLOW });
  const lines = wrap(c.safe(RISK_WARNING), c.f.regular, 7, width);
  lines.forEach((l, i) => page.drawText(l, { x: M, y: 22 - i * 8.5, size: 7, font: c.f.regular, color: SOFT }));
}

function text(
  c: Ctx,
  page: PDFPage,
  s: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = WHITE,
  width = W - 2 * M,
  leading = size * 1.3,
): number {
  for (const line of wrap(c.safe(s), font, size, width)) {
    page.drawText(line, { x, y, size, font, color });
    y -= leading;
  }
  return y;
}

function cover(c: Ctx, content: OpportunityContent) {
  const page = newPage(c);
  page.drawRectangle({ x: W * 0.58, y: 0, width: W * 0.42, height: H, color: YELLOW });
  text(c, page, "Diversity X Ventures", M + 6, H - 110, 34, c.f.bold, YELLOW);
  text(c, page, "Presents", M + 6, H - 220, 14, c.f.bold, YELLOW);
  const [main, when] = content.title.split(/,\s*(?=[^,]*$)/);
  const y = text(c, page, main ?? content.title, M + 6, H - 250, 30, c.f.bold, YELLOW, W * 0.5);
  if (when) text(c, page, when, M + 6, y - 6, 18, c.f.bold, WHITE);
  // A simple DXV mark in the yellow panel.
  const cx = W * 0.79;
  page.drawCircle({ x: cx, y: H / 2, size: 70, color: GREEN });
  const mark = "D-X";
  page.drawText(mark, { x: cx - c.f.bold.widthOfTextAtSize(mark, 40) / 2, y: H / 2 - 14, size: 40, font: c.f.bold, color: YELLOW });
  const tag = "Backing underestimated founders";
  page.drawText(tag, { x: cx - c.f.bold.widthOfTextAtSize(tag, 13) / 2, y: H / 2 - 110, size: 13, font: c.f.bold, color: GREEN });
  footer(c, page, W * 0.58 - 2 * M);
}

function contents(c: Ctx, content: OpportunityContent) {
  const page = newPage(c);
  text(c, page, "Summary", M + 6, H - 70, 30, c.f.regular, YELLOW);
  let y = H - 120;
  const groups = groupByTheme(content.deals);
  const cols = groups.length > 3 ? 2 : 1;
  const colW = (W - 2 * M - 80) / cols;
  groups.forEach((g, i) => {
    const x = M + 80 + (cols === 2 && i >= Math.ceil(groups.length / 2) ? colW : 0);
    if (cols === 2 && i === Math.ceil(groups.length / 2)) y = H - 120;
    y = text(c, page, g.theme.toUpperCase(), x, y, 12, c.f.bold, YELLOW, colW);
    for (const d of g.deals) y = text(c, page, `-  ${d.name}`, x + 20, y - 2, 12, c.f.regular, WHITE, colW - 20);
    y -= 14;
  });
  footer(c, page);
}

function divider(c: Ctx, theme: string) {
  const page = newPage(c);
  const t = c.safe(theme.toUpperCase());
  const size = Math.min(40, (W - 2 * M) / Math.max(1, c.f.bold.widthOfTextAtSize(t, 1)));
  page.drawText(t, { x: (W - c.f.bold.widthOfTextAtSize(t, size)) / 2, y: H / 2 - size / 3, size, font: c.f.bold, color: YELLOW });
  footer(c, page);
}

async function embedLogo(c: Ctx, logo: SlideLogo | undefined): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    return logo.mimeType === "image/png" ? await c.pdf.embedPng(logo.data) : await c.pdf.embedJpg(logo.data);
  } catch {
    return null; // a broken image never stops the pack
  }
}

/** A labelled paragraph ("Label: text"), bold label; returns the next y. */
function labelled(
  c: Ctx,
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  size: number,
  width: number,
  color = WHITE,
  labelColor = WHITE,
): number {
  const lines = wrap(c.safe(`${label}: ${value || "Not stated"}`), c.f.regular, size, width);
  const labelText = c.safe(`${label}:`);
  lines.forEach((line, i) => {
    if (i === 0 && line.startsWith(labelText)) {
      page.drawText(labelText, { x, y, size, font: c.f.bold, color: labelColor });
      page.drawText(line.slice(labelText.length), { x: x + c.f.bold.widthOfTextAtSize(labelText, size), y, size, font: c.f.regular, color });
    } else page.drawText(line, { x, y, size, font: c.f.regular, color });
    y -= size * 1.32;
  });
  return y;
}

/** Height the body needs at a font size (to shrink long slides so they fit). */
function bodyHeight(c: Ctx, d: OpportunityDeal, size: number, width: number): number {
  const n = (s: string) => wrap(c.safe(s), c.f.regular, size, width).length;
  const lines =
    n(`Summary: ${d.summary}`) +
    n(`Revenue to date: ${d.revenue}`) +
    n(`Early traction: ${d.traction}`) +
    n(`Use of funds: ${d.useOfFunds}`) +
    1 +
    n(d.assessment || "Not stated");
  return lines * size * 1.32 + 5 * size * 0.6;
}

async function companySlide(c: Ctx, d: OpportunityDeal, logo: SlideLogo | undefined) {
  const page = newPage(c);
  const left = M + 6;
  const half = (W - 2 * M) / 2;
  // Title and logo
  text(c, page, d.name, left, H - 56, 24, c.f.regular, YELLOW, half);
  const img = await embedLogo(c, logo);
  if (img) {
    const box = { w: 170, h: 60 };
    const s = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * s;
    const h = img.height * s;
    page.drawRectangle({ x: W - M - box.w - 12, y: H - 34 - box.h - 12, width: box.w + 12, height: box.h + 12, color: WHITE });
    page.drawImage(img, { x: W - M - box.w - 6 + (box.w - w) / 2, y: H - 34 - box.h - 6 + (box.h - h) / 2, width: w, height: h });
  }
  // Key facts: two columns
  let y = H - 90;
  y = labelled(c, page, "Sector", d.sector, left, y, 12.5, half - 20, YELLOW, YELLOW);
  y = labelled(c, page, "EIS/SEIS", d.taxScheme, left, y - 4, 12.5, half - 20, YELLOW, YELLOW);
  y = labelled(c, page, "Date founded", d.dateFounded, left, y - 4, 11.5, half - 20, WHITE, WHITE);
  let ry = H - (logo ? 124 : 96);
  ry = labelled(c, page, "Founders' diversity", d.founderDiversity, left + half, ry, 12, half - 10, WHITE, YELLOW);
  ry = labelled(c, page, "Raising", d.raising, left + half, ry - 4, 12, half - 10, WHITE, YELLOW);
  y = Math.min(y, ry) - 8;
  // Body: shrink to fit above the footer
  const width = W - 2 * M - 12;
  const room = y - 56;
  let size = 13;
  while (size > 7 && bodyHeight(c, d, size, width) > room) size -= 0.5;
  y = labelled(c, page, "Summary", d.summary, left, y, size, width);
  y = labelled(c, page, "Revenue to date", d.revenue, left, y - size * 0.6, size, width);
  y = labelled(c, page, "Early traction", d.traction, left, y - size * 0.6, size, width);
  y = labelled(c, page, "Use of funds", d.useOfFunds, left, y - size * 0.6, size, width);
  y -= size * 0.6;
  page.drawText("DXV assessment", { x: left, y, size, font: c.f.bold, color: YELLOW });
  y -= size * 1.32;
  for (const line of wrap(c.safe(d.assessment || "Not stated"), c.f.bold, size, width)) {
    if (y < 50) break; // never into the footer
    page.drawText(line, { x: left, y, size, font: c.f.bold, color: YELLOW });
    y -= size * 1.32;
  }
  footer(c, page);
}

/** The whole pack. `draft` marks every slide until the pack is approved for members. */
export async function renderOpportunityPdf(content: OpportunityContent, opts: { logos: Map<string, SlideLogo>; draft: boolean }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(content.title);
  pdf.setAuthor("Diversity X Ventures");
  const f: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const c: Ctx = { pdf, f, safe: makeSafe(f), draft: opts.draft };
  cover(c, content);
  contents(c, content);
  for (const g of groupByTheme(content.deals)) {
    divider(c, g.theme);
    for (const d of g.deals) await companySlide(c, d, opts.logos.get(d.ventureId));
  }
  return pdf.save();
}
