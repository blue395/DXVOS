// What DXV OS hands the AI for each company in an opportunities pack. Members will read the
// result, so it starts only from material already approved for members (the issued memo,
// the members' summary) plus the deck. Pure; shared with the Netlify worker.
import type { AiContextSnapshot, AssessmentPlaybook } from "../playbook/schema";

export type OpportunityDealContext = {
  ventureId: string;
  name: string;
  sector: string | null;
  stage: string | null;
  raise: string | null;
  oneLiner: string | null;
  founderDiversity: string[];
  membersSummary: string | null; // the deal room's members' summary, if written
  memo: { name: string; text: string } | null; // the latest issued DXV Review Issue
  deck: { storagePath: string; fileName: string } | null;
};

export type OpportunityContext = { round: number; themes: string[]; deals: OpportunityDealContext[]; ai: AiContextSnapshot<AssessmentPlaybook> };

export function renderOpportunityContext(ctx: OpportunityContext, d: OpportunityDealContext): string {
  return [
    "DXV OS context",
    `Company: ${d.name}`,
    ...Object.entries({ "One-line description": d.oneLiner, Sector: d.sector, "Company stage": d.stage, Raising: d.raise })
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`),
    `Founder diversity (as the founders stated it): ${d.founderDiversity.length ? d.founderDiversity.join(", ") : "not stated"}`,
    "",
    `DXV impact themes to group under: ${ctx.themes.join(", ")}`,
    "",
    d.membersSummary ? `DXV's summary for members:\n${d.membersSummary}` : "DXV's summary for members: none written.",
    "",
    d.memo
      ? `DXV's issued investment memo (${d.memo.name}):\n${d.memo.text}`
      : "DXV's investment memo: not issued yet. Write the assessment from the deck only and say the memo is pending.",
    ...(d.deck ? [] : ["", 'No pitch deck is stored: use the records above and write "Not stated" where they don\'t say.']),
  ].join("\n");
}
