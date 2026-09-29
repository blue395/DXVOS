// Renders a DocSpec as a DXV-branded Word document (A4, Arial, DXV green headings with a
// yellow rule, running header and page-numbered footer). Shared with the Netlify worker.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, DocSpec } from "./spec";

const GREEN = "1A3C35";
const YELLOW = "FBE45B";
const MUTED = "595959";
const CONTENT_WIDTH = 9026; // A4 (11906 twips) less 1440 margins either side

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function para(text: string, opts: { bold?: boolean; italics?: boolean; color?: string } = {}) {
  // Line breaks inside a paragraph become Word line breaks.
  const lines = text.split("\n");
  return new Paragraph({
    spacing: { after: 120 },
    children: lines.map((l, i) => new TextRun({ text: l, ...opts, break: i > 0 ? 1 : undefined })),
  });
}

function cell(children: Paragraph[], width: number, fill?: string) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    ...(fill ? { shading: { type: ShadingType.CLEAR, fill, color: "auto" } } : {}),
    children,
  });
}

function keyValueTable(rows: [string, string][], blank = "TBC") {
  const w = [2800, CONTENT_WIDTH - 2800];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            cell([new Paragraph({ children: [new TextRun({ text: k, bold: true, color: GREEN })] })], w[0], "EAF0EE"),
            cell([para(v || blank)], w[1]),
          ],
        }),
    ),
  });
}

function table(headers: string[], rows: string[][], widths: number[]) {
  const w = widths.map((f) => Math.round(f * CONTENT_WIDTH));
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell([new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })], w[i], GREEN)),
      }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell([para(c)], w[i])) })),
    ],
  });
}

function box(title: string, prompt: string) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell(
            [
              new Paragraph({ children: [new TextRun({ text: title, bold: true, color: GREEN })] }),
              new Paragraph({ children: [new TextRun({ text: prompt, italics: true, color: MUTED })] }),
              new Paragraph(""),
              new Paragraph(""),
            ],
            CONTENT_WIDTH,
            "F4F7F6",
          ),
        ],
      }),
    ],
  });
}

function notice(text: string) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "FEF7CE", color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: YELLOW, space: 8 } },
    spacing: { after: 240 },
    children: text.split("\n").map((l, i) => new TextRun({ text: l, bold: true, color: GREEN, break: i > 0 ? 1 : undefined })),
  });
}

function renderBlock(b: Block): (Paragraph | Table)[] {
  switch (b.kind) {
    case "heading":
      return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: b.text })] })];
    case "subheading":
      return [new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: b.text, bold: true, color: GREEN })] })];
    case "paragraph":
      return [para(b.text, { bold: b.bold, italics: b.italic, color: b.muted ? MUTED : undefined })];
    case "bullets":
      if (!b.items.length) return [para(b.empty ?? "None identified.", { italics: true, color: MUTED })];
      return b.items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(t)] }));
    case "keyValue":
      return [keyValueTable(b.rows, b.blank)];
    case "table":
      return [table(b.headers, b.rows, b.widths)];
    case "notice":
      return [notice(b.text)];
    case "box":
      return [box(b.title, b.prompt)];
    case "spacer":
      return [new Paragraph({ spacing: { after: 80 } })];
    case "pageBreak":
      return [new Paragraph({ pageBreakBefore: true })];
  }
}

export function buildDocx(spec: DocSpec): Document {
  const cover = [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: YELLOW, color: "auto" },
      spacing: { after: 240 },
      children: [new TextRun({ text: "  DXV  ", bold: true, color: GREEN, size: 28 }), new TextRun({ text: "  DIVERSITY X VENTURES", bold: true, color: GREEN, size: 20 })],
    }),
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: spec.title, bold: true, color: GREEN, size: 48 })] }),
    new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: spec.subtitle, size: 32 })] }),
    ...(spec.notice ? [notice(spec.notice)] : []),
    ...(spec.summary.length ? [keyValueTable(spec.summary)] : []),
  ];

  return new Document({
    creator: "DXV OS",
    title: `${spec.title}: ${spec.subtitle}`,
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, color: GREEN, font: "Arial" },
          paragraph: {
            spacing: { before: 360, after: 120 },
            outlineLevel: 0,
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: YELLOW, space: 4 } },
          },
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: spec.runningHeader, size: 16, color: GREEN })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Confidential. Diversity X Ventures.  Page ", size: 16, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...(spec.coverPageBreak ? [new Paragraph({ pageBreakBefore: true })] : []), ...spec.blocks.flatMap(renderBlock)],
      },
    ],
  });
}

export async function renderDocx(spec: DocSpec): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(spec));
}
