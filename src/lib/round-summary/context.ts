// What DXV OS hands the AI for each deal in a round summary. Snapshotted onto the job.
// Pure; shared with the Netlify worker (relative imports only).
import type { AiContextSnapshot, AssessmentPlaybook } from "../playbook/schema";
import type { DealFacts } from "./schema";

export type SummaryDealContext = {
  ventureId: string;
  name: string;
  facts: DealFacts;
  details: Record<string, string | null>; // founders, website, description...
  eligibilityScreen: string | null;
  eligibilityDecisions: string[];
  memo: { name: string; text: string } | null; // latest issue, review draft or AI draft
  /** What the founders told DXV directly: application form and founder diversity (renderFounderInfo()). */
  founderInfo?: string | null;
  deck: { storagePath: string; fileName: string } | null;
};

export type RoundSummaryContext = {
  round: number;
  deals: SummaryDealContext[];
  ai: AiContextSnapshot<AssessmentPlaybook>;
};

export function renderDealContext(round: number, d: SummaryDealContext): string {
  const f = d.facts;
  return [
    "DXV OS context",
    `Venture: ${d.name}`,
    `DXV round: Round ${round}`,
    ...Object.entries({ "One-line description": f.oneLiner, Sector: f.sector, "Company stage": f.stage, Raising: f.raise, ...d.details })
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`),
    "",
    "Eligibility screen (AI first pass, reviewed by a partner):",
    d.eligibilityScreen ?? "None on record.",
    "",
    "Partner eligibility decisions and notes:",
    ...(d.eligibilityDecisions.length ? d.eligibilityDecisions.map((x) => `- ${x}`) : ["None on record."]),
    "",
    d.memo ? `Investment memo so far (${d.memo.name}):\n${d.memo.text}` : "Investment memo: none yet.",
    ...(d.founderInfo ? ["", d.founderInfo] : []),
    ...(d.deck ? [] : ["", "No pitch deck is stored for this deal: summarise from the records above and say the deck is missing."]),
  ].join("\n");
}
