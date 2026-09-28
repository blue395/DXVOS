// The review banner and plain-text rendering of a memo (DXV template order).
import type { MemoContent } from "./schema";
import { MAX_TOTAL_SCORE, totalScore } from "./schema";

/** §4 of DXV's memo assistant document, verbatim. Added by the app to every AI draft. */
export const REVIEW_BANNER = [
  "DRAFT — AI-assisted first pass. Requires DXV team review before circulation to the syndicate.",
  "Scores and the investment case below are a starting point, not a final view.",
];

const bullets = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- None");
const list = (items: string[]) => (items.length ? items.join(", ") : "None");

/**
 * Plain text in the template's order, for pasting into a document.
 * `banner`: true for AI drafts and drafts under review; false once finalised.
 */
export function renderMemo(m: MemoContent, opts: { banner: boolean; footer?: string }): string {
  const h = m.header;
  const parts = [
    ...(opts.banner ? [REVIEW_BANNER.join("\n")] : []),
    [
      `Business name: ${h.businessName}`,
      `Round: ${h.round}`,
      `Stage: ${h.stage}`,
      `Business model: ${h.businessModel}`,
      `SDGs: ${list(h.sdgs)}`,
      `Impact thesis: ${h.impactThesis}`,
      `Impact themes: ${list(h.impactThemes)}`,
      `Diversity themes: ${h.diversityThemes.length ? h.diversityThemes.join(", ") : "Not stated"}`,
    ].join("\n"),
    `EXECUTIVE SUMMARY\n${m.executiveSummary}`,
    `INVESTMENT CASE\n${bullets(m.investmentCase)}`,
    `CONCLUSION\n${m.conclusion}`,
    `SCORING (${totalScore(m.scores)}/${MAX_TOTAL_SCORE})\n` + m.scores.map((s) => `${s.criterion}: ${s.score}/5. ${s.justification}`).join("\n"),
    `SWOT SUMMARY\nStrengths:\n${bullets(m.swot.strengths)}\nWeaknesses:\n${bullets(m.swot.weaknesses)}\nOpportunities:\n${bullets(m.swot.opportunities)}\nThreats:\n${bullets(m.swot.threats)}`,
    `KEY FOLLOW-UP QUESTIONS FOR FOUNDERS\n${bullets(m.followUpQuestions)}`,
    ...(opts.footer ? [opts.footer] : []),
  ];
  return parts.join("\n\n");
}
