// Assembling and editing the members' opportunities pack. Pure; shared with the worker.
import type { OpportunityContext } from "./context";
import { OPPORTUNITY_FIELDS, type OpportunityAiOutput, type OpportunityContent, type OpportunityDeal } from "./schema";

/** "Syndicate Opportunities, November 2026" (UK time). */
export function packTitle(date: Date): string {
  return `Syndicate Opportunities, ${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" }).format(date)}`;
}

export const packName = (number: number) => `Pack ${number}`;

/** The working copy from the AI's drafts, one slide per company in the context's order. Facts come from DXV OS. */
export function buildOpportunityContent(ctx: OpportunityContext, ai: OpportunityAiOutput, title: string): OpportunityContent {
  return {
    title,
    deals: ctx.deals.map((d): OpportunityDeal => {
      const out = ai.deals.find((x) => x.ventureId === d.ventureId);
      const draft = out?.draft;
      return {
        ventureId: d.ventureId,
        name: d.name,
        sector: d.sector ?? "",
        founderDiversity: d.founderDiversity.join(", "),
        summary: draft?.summary ?? d.oneLiner ?? "",
        dateFounded: draft?.dateFounded ?? "",
        revenue: draft?.revenue ?? "",
        traction: draft?.traction ?? "",
        useOfFunds: draft?.useOfFunds ?? "",
        taxScheme: draft?.taxScheme ?? "TBC",
        raising: draft?.raising ?? [d.stage, d.raise].filter(Boolean).join(" "),
        assessment: draft?.assessment ?? "",
        theme: draft?.theme ?? ctx.themes[0] ?? "Other",
        error: draft ? null : (out?.error ?? "Not drafted."),
      };
    }),
  };
}

/** Apply the editor's form: `title`, and `<ventureId>.<field>` for each slide. Companies come from the stored copy, never the form. */
export function applyOpportunityEdits(content: OpportunityContent, get: (name: string) => string | null): OpportunityContent {
  return {
    title: (get("title") ?? content.title).trim() || content.title,
    deals: content.deals.map((d) => {
      const next = { ...d };
      for (const [field] of OPPORTUNITY_FIELDS) {
        const v = get(`${d.ventureId}.${field}`);
        if (v !== null) next[field] = v.replace(/\r\n/g, "\n").trim();
      }
      return next;
    }),
  };
}

/** Slides grouped by impact theme, in the order themes first appear. */
export function groupByTheme(deals: OpportunityDeal[]): { theme: string; deals: OpportunityDeal[] }[] {
  const groups: { theme: string; deals: OpportunityDeal[] }[] = [];
  for (const d of deals) {
    const theme = d.theme.trim() || "Other";
    let g = groups.find((x) => x.theme.toLowerCase() === theme.toLowerCase());
    if (!g) groups.push((g = { theme, deals: [] }));
    g.deals.push(d);
  }
  return groups;
}

/** Why a pack can't be approved for members yet, or null. Every company must be shared with members and every slide filled. */
export function approvalProblems(content: OpportunityContent, shared: Set<string>): string[] {
  const out: string[] = [];
  for (const d of content.deals) {
    if (!shared.has(d.ventureId)) out.push(`${d.name} isn't shared with members yet (deal page, Members' deal room).`);
    if (!d.summary.trim() || !d.assessment.trim()) out.push(`${d.name} needs a summary and DXV assessment.`);
  }
  if (!content.deals.length) out.push("The pack has no companies.");
  return out;
}
