// Export specs for the documents DXV OS writes: the AI eligibility screen and the
// investment memo (AI Draft, DXV Review Draft, DXV Review Issue). The DD report's
// spec lives in dd-doc/build.ts. Pure: the export route loads data and renders.
import type { EligibilityScreen } from "../deck-ai/schema";
import { REVIEW_BANNER } from "../memo-ai/render";
import { MAX_TOTAL_SCORE, totalScore, type MemoContent } from "../memo-ai/schema";
import { formatLongDate, type Block, type DocSpec } from "./spec";

const list = (items: string[], none = "None") => (items.length ? items.join(", ") : none);

export function screenSpec(
  s: EligibilityScreen,
  meta: { ventureName: string; fileName: string; model: string | null; screenedAt: Date; decisions: string[] },
): DocSpec {
  const blocks: Block[] = [
    { kind: "heading", text: "Summary" },
    { kind: "paragraph", text: s.oneLineSummary },
    { kind: "heading", text: "Stage fit" },
    { kind: "subheading", text: s.stageFit.rating },
    { kind: "paragraph", text: s.stageFit.reasoning },
    { kind: "heading", text: "Sector" },
    { kind: "subheading", text: s.sector.name },
    { kind: "paragraph", text: s.sector.note },
    { kind: "heading", text: "Team strength" },
    { kind: "paragraph", text: s.teamStrength },
    { kind: "heading", text: "DXV thesis fit" },
    { kind: "subheading", text: s.thesisFit.rating },
    { kind: "paragraph", text: s.thesisFit.reasoning },
    { kind: "heading", text: "Red flags" },
    { kind: "bullets", items: s.redFlags, empty: "None identified." },
    { kind: "heading", text: "Next step" },
    { kind: "paragraph", text: s.nextStep },
    ...(meta.decisions.length ? ([{ kind: "heading", text: "DXV decisions" }, { kind: "bullets", items: meta.decisions }] as Block[]) : []),
  ];
  return {
    title: "Eligibility Screen",
    subtitle: meta.ventureName,
    runningHeader: `DXV Eligibility Screen  |  ${meta.ventureName}`,
    notice: "AI first pass, not a decision. Suggestions only: read the deck before deciding.",
    summary: [
      ["Company", s.companyName],
      ["AI recommendation", s.recommendation],
      ["Stage fit", s.stageFit.rating],
      ["DXV thesis fit", s.thesisFit.rating],
      ["Deck", meta.fileName],
      ["Screened", `${formatLongDate(meta.screenedAt)}${meta.model ? ` (${meta.model})` : ""}`],
    ],
    blocks,
  };
}

/**
 * The investment memo in DXV's template order. `banner` for AI drafts and drafts
 * under review (the app-rendered review banner, never model-generated); issues have
 * a footer instead.
 */
export function memoSpec(m: MemoContent, meta: { name: string; ventureName: string; banner: boolean; footer?: string; date: Date }): DocSpec {
  const h = m.header;
  const total = totalScore(m.scores);
  const blocks: Block[] = [
    { kind: "heading", text: "Executive summary" },
    { kind: "paragraph", text: m.executiveSummary },
    { kind: "heading", text: "Investment case" },
    { kind: "bullets", items: m.investmentCase, empty: "None." },
    { kind: "heading", text: "Conclusion" },
    { kind: "paragraph", text: m.conclusion },
    { kind: "heading", text: `Scoring (${total}/${MAX_TOTAL_SCORE})` },
    {
      kind: "table",
      headers: ["Criterion", "Score", "Justification"],
      rows: [...m.scores.map((s) => [s.criterion, `${s.score}/5`, s.justification]), ["Total", `${total}/${MAX_TOTAL_SCORE}`, ""]],
      widths: [0.26, 0.1, 0.64],
    },
    { kind: "heading", text: "SWOT summary" },
    { kind: "subheading", text: "Strengths" },
    { kind: "bullets", items: m.swot.strengths, empty: "None." },
    { kind: "subheading", text: "Weaknesses" },
    { kind: "bullets", items: m.swot.weaknesses, empty: "None." },
    { kind: "subheading", text: "Opportunities" },
    { kind: "bullets", items: m.swot.opportunities, empty: "None." },
    { kind: "subheading", text: "Threats" },
    { kind: "bullets", items: m.swot.threats, empty: "None." },
    { kind: "heading", text: "Key follow-up questions for founders" },
    { kind: "bullets", items: m.followUpQuestions, empty: "None." },
    ...(meta.footer ? ([{ kind: "spacer" }, { kind: "paragraph", text: meta.footer, italic: true, muted: true }] as Block[]) : []),
  ];
  return {
    title: meta.name,
    subtitle: meta.ventureName,
    runningHeader: `DXV Investment Memo  |  ${meta.ventureName}  |  ${meta.name}`,
    notice: meta.banner ? REVIEW_BANNER.join("\n") : undefined,
    summary: [
      ["Business name", h.businessName],
      ["Round", h.round],
      ["Stage", h.stage],
      ["Business model", h.businessModel],
      ["SDGs", list(h.sdgs)],
      ["Impact thesis", h.impactThesis],
      ["Impact themes", list(h.impactThemes)],
      ["Diversity themes", list(h.diversityThemes, "Not stated")],
      ["Total score", `${total}/${MAX_TOTAL_SCORE}`],
      ["Version", `${meta.name}, ${formatLongDate(meta.date)}`],
    ],
    blocks,
  };
}
