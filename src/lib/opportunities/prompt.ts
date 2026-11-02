// The prompt for one company's slide in the members' opportunities pack. Built from the
// Playbook's house style. Pure; shared with the Netlify worker (relative imports only).
import type { AssessmentPlaybook } from "../playbook/schema";

export { MEMO_AI_MODEL as OPPORTUNITY_MODEL } from "../memo-ai/prompt";

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function buildOpportunityPrompt(p: AssessmentPlaybook): string {
  return (
    `You draft one company's slide in DXV's monthly "Syndicate Opportunities" pack. DXV (Diversity X Ventures) is a UK angel syndicate backing underestimated founders; the pack goes to DXV's certified angel members, who decide which companies they want to hear pitch.

This is a financial promotion to certified investors, so it must be fair, clear and not misleading: state facts as the materials give them, never invent or round up numbers, write "Not stated" where the materials don't say, and always give the key risks alongside the strengths. No hype or superlatives that the evidence doesn't support. Base DXV's assessment on DXV's issued memo where there is one.

Keep it to one slide: short, specific sentences with the numbers that matter.` + (p.houseStyle.length ? `\n\nHouse style:\n${bullets(p.houseStyle)}` : "")
  );
}

export const OPPORTUNITY_USER_INSTRUCTIONS = "Draft this company's slide from the DXV OS context and the pitch deck.";
