// Turns the structured screen into DXV's required text format, and enforces the
// house style rules that can be checked mechanically. Pure; shared with the worker.
import type { DeckAnalysisOutput, EligibilityScreen } from "./schema";

/**
 * House style: no em/en-dashes, no arrows, no emoji. The prompt asks for this; this
 * makes it certain. (Banned stock phrases can't be fixed mechanically; the prompt covers them.)
 */
export function applyHouseStyle(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, " - ") // em/en dash to spaced hyphen
    .replace(/\s*(→|->|⟶|➔)\s*/g, " to ")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Apply house style to every string in the output, recursively. */
export function cleanOutput(output: DeckAnalysisOutput): DeckAnalysisOutput {
  const clean = (v: unknown): unknown => {
    if (typeof v === "string") return applyHouseStyle(v);
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  const cleaned = clean(output) as DeckAnalysisOutput;
  cleaned.screen.redFlags = cleaned.screen.redFlags.filter((f) => f.length > 0);
  return cleaned;
}

/** The template's "Required output format", with a spaced hyphen where it used an em-dash. */
export function renderScreen(s: EligibilityScreen): string {
  const redFlags = s.redFlags.length === 0 ? "None identified" : "\n" + s.redFlags.map((f) => `- ${f}`).join("\n");
  return [
    `ELIGIBILITY SCREEN: ${s.companyName}`,
    `One-line summary: ${s.oneLineSummary}`,
    `Recommendation: ${s.recommendation}`,
    `Stage fit: ${s.stageFit.rating} - ${s.stageFit.reasoning}`,
    `Sector: ${s.sector.name} - ${s.sector.note}`,
    `Team strength: ${s.teamStrength}`,
    `DXV thesis fit: ${s.thesisFit.rating} - ${s.thesisFit.reasoning}`,
    `Red flags: ${redFlags}`,
    `Next step: ${s.nextStep}`,
    ...(s.otherCriteria ?? []).map((c) => `${c.criterion}: ${c.assessment}`),
  ].join("\n\n");
}
