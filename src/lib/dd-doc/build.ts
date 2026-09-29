// The DXV Due Diligence report, described once as a DocSpec and rendered to Word
// (stored by the worker) or PDF (on export). Pure (no AI, no storage).
// Shared with the Netlify worker: no Next-only imports.
import { renderDocx } from "../export/docx";
import { exportFileName, formatLongDate, type Block, type DocSpec } from "../export/spec";
import type { DDContext } from "./context";
import type { DDPlan } from "./schema";

const NOTICE = "DRAFT: AI-assisted first pass. Requires DXV team review before circulation to the DD group or syndicate.";
const FINDINGS_PLACEHOLDER = "To be completed by the DXV DD group.";

export function ddSpec(ctx: DDContext, plan: DDPlan, generatedAt: Date): DocSpec {
  const n = plan.areas.length;
  const blocks: Block[] = [
    { kind: "heading", text: "1. Purpose and scope" },
    { kind: "paragraph", text: plan.scope },
    { kind: "heading", text: "2. Priority risks to resolve" },
    { kind: "bullets", items: plan.priorityRisks },
    ...plan.areas.flatMap((a, i): Block[] => [
      { kind: "heading", text: `${i + 3}. ${a.area}` },
      { kind: "paragraph", text: a.focus },
      { kind: "subheading", text: "Key questions for the founders" },
      { kind: "bullets", items: a.questions },
      { kind: "subheading", text: "Evidence to request" },
      { kind: "bullets", items: a.evidenceToRequest },
      { kind: "subheading", text: "What to watch for" },
      { kind: "bullets", items: a.watchFor },
      { kind: "spacer" },
      { kind: "box", title: "Findings", prompt: FINDINGS_PLACEHOLDER },
    ]),
    { kind: "heading", text: `${n + 3}. Documents requested` },
    {
      kind: "table",
      headers: ["Document", "Requested", "Received", "Notes"],
      rows: (plan.documentsRequested.length ? plan.documentsRequested : ["(none listed)"]).map((d) => [d, "", "", ""]),
      widths: [0.47, 0.155, 0.155, 0.22],
    },
    { kind: "heading", text: `${n + 4}. DD conclusion and recommendation` },
    { kind: "paragraph", text: "To be completed by the DXV team once DD is finished.", italic: true, muted: true },
    { kind: "subheading", text: "Summary of findings" },
    { kind: "box", title: "Findings", prompt: "Key findings across all areas." },
    { kind: "subheading", text: "Recommendation" },
    { kind: "paragraph", text: "Proceed to investment / Proceed with conditions / Do not proceed (delete as appropriate)" },
    { kind: "subheading", text: "Conditions or follow-ups" },
    { kind: "box", title: "Findings", prompt: "Conditions to be met before completion, if any." },
    { kind: "subheading", text: "Sign-off" },
    {
      kind: "keyValue",
      rows: [
        ["DD lead", ""],
        ["Reviewed by (DXV)", ""],
        ["Date", ""],
      ],
      blank: "",
    },
  ];
  return {
    title: "Due Diligence Report",
    subtitle: ctx.ventureName,
    runningHeader: `DXV Due Diligence  |  ${ctx.ventureName}`,
    notice: NOTICE,
    summary: [
      ...ctx.details.map((d): [string, string] => [d.label, d.value]),
      ["Investment memo", ctx.memo?.name ?? "None yet"],
      ["Prepared by", `${ctx.preparedBy} (DXV OS, AI-assisted)`],
      ["Date", formatLongDate(generatedAt)],
      ["Status", "Draft"],
    ],
    coverPageBreak: true,
    blocks,
  };
}

export async function buildDDDocx(ctx: DDContext, plan: DDPlan, generatedAt = new Date()): Promise<Buffer> {
  return renderDocx(ddSpec(ctx, plan, generatedAt));
}

/** File name for the generated document. */
export function ddFileName(ventureName: string, generatedAt: Date, ext: "docx" | "pdf" = "docx"): string {
  return exportFileName("DXV DD Report", ventureName, generatedAt, ext);
}
