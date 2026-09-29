// Renders a DocSpec as a DXV-branded PDF with pdf-lib (pure JavaScript, built-in
// Helvetica, so it runs anywhere, including Netlify functions). A small layout engine:
// word wrap, page breaks, tables, running header and "Page N of M" footer.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block, DocSpec } from "./spec";

const GREEN = rgb(0x1a / 255, 0x3c / 255, 0x35 / 255);
const YELLOW = rgb(0xfb / 255, 0xe4 / 255, 0x5b / 255);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.35, 0.35);
const RULE = rgb(0.75, 0.75, 0.75);
const TINT = rgb(0.918, 0.941, 0.933); // green/8 on white (label cells)
const BOX = rgb(0.957, 0.969, 0.965);
const NOTICE_BG = rgb(0.996, 0.969, 0.808);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const TOP = PAGE_H - 70; // below the running header
const BOTTOM = 64; // above the footer
const WIDTH = PAGE_W - 2 * MARGIN;
const BODY = 10;
const LEADING = 14;

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

// Standard PDF fonts only cover Windows-1252 characters: swap or drop anything else.
const REPLACEMENTS: Record<string, string> = { "→": "to", "✓": "v", "≥": ">=", "≤": "<=", " ": " ", "\t": " " };
function makeSafe(fonts: Fonts) {
  const cache = new Map<string, boolean>();
  const ok = (ch: string) => {
    if (!cache.has(ch)) {
      try {
        fonts.regular.widthOfTextAtSize(ch, 10);
        cache.set(ch, true);
      } catch {
        cache.set(ch, false);
      }
    }
    return cache.get(ch)!;
  };
  return (text: string) => [...text].map((ch) => (ch === "\n" ? ch : REPLACEMENTS[ch] ?? (ok(ch) ? ch : ""))).join("");
}

/** Wrap text to a width; explicit newlines start new lines. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the line: break it by characters.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let n = w.length;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

class Writer {
  page!: PDFPage;
  y = TOP;
  constructor(
    private doc: PDFDocument,
    private f: Fonts,
    private safe: (t: string) => string,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = TOP;
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  text(t: string, x: number, y: number, size: number, font: PDFFont, color = BLACK) {
    this.page.drawText(this.safe(t), { x, y, size, font, color });
  }

  lines(t: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; width?: number; leading?: number } = {}) {
    const font = opts.font ?? this.f.regular;
    const size = opts.size ?? BODY;
    const leading = opts.leading ?? LEADING;
    const indent = opts.indent ?? 0;
    for (const line of wrap(this.safe(t), font, size, (opts.width ?? WIDTH) - indent)) {
      this.ensure(leading);
      this.y -= leading;
      this.page.drawText(line, { x: MARGIN + indent, y: this.y + 3, size, font, color: opts.color ?? BLACK });
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  /** A table row; cells wrap, the row moves to a new page if it doesn't fit. */
  row(cells: { text: string; width: number; font?: PDFFont; color?: ReturnType<typeof rgb>; fill?: ReturnType<typeof rgb> }[]) {
    const pad = 6;
    const wrapped = cells.map((c) => wrap(this.safe(c.text || " "), c.font ?? this.f.regular, BODY, c.width - 2 * pad));
    const h = Math.max(...wrapped.map((w) => w.length)) * LEADING + 2 * pad - 2;
    this.ensure(h);
    let x = MARGIN;
    cells.forEach((c, i) => {
      this.page.drawRectangle({ x, y: this.y - h, width: c.width, height: h, color: c.fill ?? WHITE, borderColor: RULE, borderWidth: 0.5 });
      wrapped[i].forEach((line, j) => {
        this.page.drawText(line, { x: x + pad, y: this.y - pad - (j + 1) * LEADING + 4, size: BODY, font: c.font ?? this.f.regular, color: c.color ?? BLACK });
      });
      x += c.width;
    });
    this.y -= h;
  }

  /** Shaded callout with a yellow left bar. */
  notice(t: string) {
    const lines = wrap(this.safe(t), this.f.bold, BODY, WIDTH - 24);
    const h = lines.length * LEADING + 14;
    this.ensure(h);
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: WIDTH, height: h, color: NOTICE_BG });
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: 4, height: h, color: YELLOW });
    lines.forEach((line, j) => this.page.drawText(line, { x: MARGIN + 14, y: this.y - 7 - (j + 1) * LEADING + 4, size: BODY, font: this.f.bold, color: GREEN }));
    this.y -= h + 12;
  }

  /** `next`: the following block, so a heading never ends up alone at the foot of a page. */
  block(b: Block, next?: Block) {
    const f = this.f;
    switch (b.kind) {
      case "heading":
        // Keep a heading with the start of its section (more room when a table or box follows).
        this.ensure(next && ["table", "keyValue", "box"].includes(next.kind) ? 130 : 75);
        this.gap(16);
        this.text(b.text, MARGIN, this.y - 14, 14, f.bold, GREEN);
        this.page.drawRectangle({ x: MARGIN, y: this.y - 21, width: WIDTH, height: 1.5, color: YELLOW });
        this.gap(30);
        return;
      case "subheading":
        this.ensure(34);
        this.gap(6);
        this.lines(b.text, { font: f.bold, color: GREEN });
        return;
      case "paragraph":
        this.lines(b.text, { font: b.bold ? f.bold : b.italic ? f.italic : f.regular, color: b.muted ? MUTED : BLACK });
        this.gap(6);
        return;
      case "bullets":
        if (!b.items.length) {
          this.lines(b.empty ?? "None identified.", { font: f.italic, color: MUTED });
        } else {
          for (const item of b.items) {
            this.ensure(LEADING); // the bullet and the item's first line land on the same page
            this.text("•", MARGIN + 3, this.y - LEADING + 3, BODY, f.bold, GREEN);
            this.lines(item, { indent: 14 });
          }
        }
        this.gap(6);
        return;
      case "keyValue":
        for (const [k, v] of b.rows) {
          this.row([
            { text: k, width: WIDTH * 0.31, font: f.bold, color: GREEN, fill: TINT },
            { text: v || (b.blank ?? "TBC"), width: WIDTH * 0.69 },
          ]);
        }
        this.gap(12);
        return;
      case "table":
        this.row(b.headers.map((h, i) => ({ text: h, width: WIDTH * b.widths[i], font: f.bold, color: WHITE, fill: GREEN })));
        for (const r of b.rows) this.row(r.map((c, i) => ({ text: c, width: WIDTH * b.widths[i] })));
        this.gap(12);
        return;
      case "notice":
        this.notice(b.text);
        return;
      case "box": {
        const prompt = wrap(this.safe(b.prompt), f.italic, BODY, WIDTH - 20);
        const h = (prompt.length + 1) * LEADING + 44;
        this.ensure(h);
        this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: WIDTH, height: h, color: BOX, borderColor: RULE, borderWidth: 0.5 });
        this.text(b.title, MARGIN + 10, this.y - 18, BODY, f.bold, GREEN);
        prompt.forEach((line, j) => this.text(line, MARGIN + 10, this.y - 18 - (j + 1) * LEADING, BODY, f.italic, MUTED));
        this.y -= h + 12;
        return;
      }
      case "spacer":
        this.gap(8);
        return;
      case "pageBreak":
        this.newPage();
        return;
    }
  }
}

export async function renderPdf(spec: DocSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${spec.title}: ${spec.subtitle}`);
  doc.setCreator("DXV OS");
  doc.setProducer("DXV OS");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const safe = makeSafe(fonts);
  const w = new Writer(doc, fonts, safe);

  // Cover: brand bar, title, venture, notice, key facts.
  w.page.drawRectangle({ x: MARGIN, y: w.y - 26, width: WIDTH, height: 26, color: YELLOW });
  w.text("DXV", MARGIN + 10, w.y - 18, 13, fonts.bold, GREEN);
  w.text("DIVERSITY X VENTURES", MARGIN + 48, w.y - 17, 9, fonts.bold, GREEN);
  w.gap(66);
  w.lines(spec.title, { font: fonts.bold, size: 24, color: GREEN, leading: 28 });
  w.gap(6);
  w.lines(spec.subtitle, { size: 16, leading: 20 });
  w.gap(18);
  if (spec.notice) w.notice(spec.notice);
  if (spec.summary.length) w.block({ kind: "keyValue", rows: spec.summary });
  if (spec.coverPageBreak) w.newPage();
  spec.blocks.forEach((b, i) => w.block(b, spec.blocks[i + 1]));

  // Running header and footer on every page.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const header = safe(spec.runningHeader);
    p.drawText(header, { x: PAGE_W - MARGIN - fonts.regular.widthOfTextAtSize(header, 8), y: PAGE_H - 40, size: 8, font: fonts.regular, color: GREEN });
    const footer = `Confidential. Diversity X Ventures.  Page ${i + 1} of ${pages.length}`;
    p.drawText(footer, { x: (PAGE_W - fonts.regular.widthOfTextAtSize(footer, 8)) / 2, y: 36, size: 8, font: fonts.regular, color: MUTED });
  });

  return doc.save();
}
