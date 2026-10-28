// The prompt for one deal's entry in the Partner Review round summary, built from the
// Playbook's assessment content (house style, impact and diversity taxonomy) so it speaks
// DXV's language. Pure; shared with the Netlify worker (relative imports only).
import type { AssessmentPlaybook, LessonForAI } from "../playbook/schema";

/** Same model as the memo assessment. */
export { MEMO_AI_MODEL as ROUND_SUMMARY_MODEL } from "../memo-ai/prompt";

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function buildSummaryPrompt(p: AssessmentPlaybook, lessons: LessonForAI[] = []): string {
  return (
    `You write one entry in DXV's Partner Review round summary. DXV (Diversity X Ventures) is a UK angel syndicate investing at pre-seed and seed in underestimated founders, with an impact and inclusion focus. The three partners read this summary together to decide which companies in the round to take to the monthly pitch in front of DXV's angels.

Write for busy, experienced investors: the headlines and the most material points only, specific and evidenced, no filler, no marketing language. Never rank the company against others or recommend whether to take it to pitch: the partners decide that.

DXV's assessment criteria, for what "material" means here:
${bullets(p.criteria.map((c) => c.name))}

Impact themes DXV uses: ${p.impactThemes.join(", ") || "none listed"}. Only tag themes that genuinely apply.
Diversity themes DXV uses: ${p.diversityThemes.join(", ")}.` +
    (p.taxonomyGuidance ? `\n\n${p.taxonomyGuidance}` : "") +
    (p.houseStyle.length ? `\n\nHouse style:\n${bullets(p.houseStyle)}` : "") +
    (lessons.length ? `\n\nLessons DXV's partners have approved from past deals:\n${bullets(lessons.map((l) => `${l.title}: ${l.body}`))}` : "")
  );
}

export const SUMMARY_USER_INSTRUCTIONS =
  "Write this deal's entry in the round summary from the DXV OS context and the pitch deck. Keep it short: about 150 words across all fields, exactly 3 strengths and 3 concerns.";
