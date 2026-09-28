// Builds the DXV-branded Due Diligence Word document. Pure (no AI, no storage),
// so it can be tested on its own. Brand: DXV green #1A3C35, yellow #FBE45B, black, white.
// Shared with the Netlify worker: no Next-only imports.
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
import type { DDContext } from "./context";
import type { DDPlan } from "./schema";

const GREEN = "1A3C35";
const YELLOW = "FBE45B";
const CONTENT_WIDTH = 9026; // A4 (11906 twips) less 1440 margins either side

const NOTICE = "DRAFT: AI-assisted first pass. Requires DXV team review before circulation to the DD group or syndicate.";
const FINDINGS_PLACEHOLDER = "To be completed by the DXV DD group.";

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, children: [new TextRun({ text })] });
}

function para(text: string, opts: { bold?: boolean; italics?: boolean; color?: string } = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...opts })] });
}

function bullets(items: string[], empty = "None identified.") {
  if (!items.length) return [para(empty, { italics: true, color: "595959" })];
  return items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(t)] }));
}

function label(text: string) {
  return new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text, bold: true, color: GREEN })] });
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

/** Label/value table (deal summary, sign-off). Empty values print `blank` (TBC, or nothing to write on). */
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
            cell([new Paragraph(v || blank)], w[1]),
          ],
        }),
    ),
  });
}

/** A shaded box for the team to write findings in. */
function findingsBox(prompt = FINDINGS_PLACEHOLDER) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell(
            [
              new Paragraph({ children: [new TextRun({ text: "Findings", bold: true, color: GREEN })] }),
              new Paragraph({ children: [new TextRun({ text: prompt, italics: true, color: "595959" })] }),
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

function documentsTable(docs: string[]) {
  const w = [4226, 1400, 1400, 2000];
  const head = ["Document", "Requested", "Received", "Notes"];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({
        tableHeader: true,
        children: head.map((h, i) => cell([new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })], w[i], GREEN)),
      }),
      ...(docs.length ? docs : ["(none listed)"]).map(
        (d) => new TableRow({ children: [cell([new Paragraph(d)], w[0]), cell([new Paragraph("")], w[1]), cell([new Paragraph("")], w[2]), cell([new Paragraph("")], w[3])] }),
      ),
    ],
  });
}

export function buildDDDocument(ctx: DDContext, plan: DDPlan, generatedAt: Date): Document {
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(generatedAt);

  const cover = [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: YELLOW, color: "auto" },
      spacing: { after: 240 },
      children: [new TextRun({ text: "  DXV  ", bold: true, color: GREEN, size: 28 }), new TextRun({ text: "  DIVERSITY X VENTURES", bold: true, color: GREEN, size: 20 })],
    }),
    new Paragraph({ spacing: { before: 480, after: 120 }, children: [new TextRun({ text: "Due Diligence Report", bold: true, color: GREEN, size: 56 })] }),
    new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: ctx.ventureName, size: 36 })] }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: "FEF7CE", color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: YELLOW, space: 8 } },
      spacing: { after: 360 },
      children: [new TextRun({ text: NOTICE, bold: true, color: GREEN })],
    }),
    keyValueTable([
      ...ctx.details.map((d): [string, string] => [d.label, d.value]),
      ["Investment memo", ctx.memo?.name ?? "None yet"],
      ["Prepared by", `${ctx.preparedBy} (DXV OS, AI-assisted)`],
      ["Date", date],
      ["Status", "Draft"],
    ]),
  ];

  const body = [
    heading("1. Purpose and scope"),
    para(plan.scope),
    heading("2. Priority risks to resolve"),
    ...bullets(plan.priorityRisks),
    ...plan.areas.flatMap((a, i) => [
      heading(`${i + 3}. ${a.area}`),
      para(a.focus),
      label("Key questions for the founders"),
      ...bullets(a.questions),
      label("Evidence to request"),
      ...bullets(a.evidenceToRequest),
      label("What to watch for"),
      ...bullets(a.watchFor),
      new Paragraph({ spacing: { after: 80 } }),
      findingsBox(),
    ]),
    heading(`${plan.areas.length + 3}. Documents requested`),
    documentsTable(plan.documentsRequested),
    heading(`${plan.areas.length + 4}. DD conclusion and recommendation`),
    para("To be completed by the DXV team once DD is finished.", { italics: true, color: "595959" }),
    label("Summary of findings"),
    findingsBox("Key findings across all areas."),
    label("Recommendation"),
    para("Proceed to investment / Proceed with conditions / Do not proceed (delete as appropriate)"),
    label("Conditions or follow-ups"),
    findingsBox("Conditions to be met before completion, if any."),
    label("Sign-off"),
    keyValueTable([
      ["DD lead", ""],
      ["Reviewed by (DXV)", ""],
      ["Date", ""],
    ], ""),
  ];

  return new Document({
    creator: "DXV OS",
    title: `Due Diligence Report: ${ctx.ventureName}`,
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
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `DXV Due Diligence  |  ${ctx.ventureName}`, size: 16, color: GREEN })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Confidential. Diversity X Ventures.  Page ", size: 16, color: "595959" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "595959" }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, new Paragraph({ pageBreakBefore: true }), ...body],
      },
    ],
  });
}

export async function buildDDDocx(ctx: DDContext, plan: DDPlan, generatedAt = new Date()): Promise<Buffer> {
  return Packer.toBuffer(buildDDDocument(ctx, plan, generatedAt));
}

/** File name for the generated document. */
export function ddFileName(ventureName: string, generatedAt: Date): string {
  const safe = ventureName.replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, " ") || "Venture";
  return `DXV DD Report - ${safe} - ${generatedAt.toISOString().slice(0, 10)}.docx`;
}
