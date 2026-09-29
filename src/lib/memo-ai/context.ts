// What DXV OS already knows about a venture, handed to the AI alongside the deck
// (the memo document asks for the eligibility screen etc. "rather than starting cold").
// Snapshotted onto each MemoAnalysis, so every draft records what it was given.

import type { AiContextSnapshot, AssessmentPlaybook } from "../playbook/schema";

export type MemoContext = {
  ventureName: string;
  dxvRound: string; // "Round 3" or "Not assigned"
  details: Record<string, string | null>; // sector, company stage, raise, website, description...
  eligibilityScreen: string | null; // rendered eligibility screen text
  eligibilityDecisions: string[]; // partner decisions and notes
  founderCommsNotes: string[];
  deck: { storagePath: string; fileName: string } | null;
  /** Playbook version and approved lessons given to the AI (absent on jobs before 2026-09-30: defaults). */
  ai?: AiContextSnapshot<AssessmentPlaybook>;
};

export function renderContext(c: MemoContext): string {
  const lines = [
    "DXV OS context",
    `Venture: ${c.ventureName}`,
    `DXV round: ${c.dxvRound}`,
    ...Object.entries(c.details)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`),
    "",
    "Eligibility screen (AI first pass, reviewed by a partner):",
    c.eligibilityScreen ?? "None on record.",
    "",
    "Partner eligibility decisions and notes:",
    ...(c.eligibilityDecisions.length ? c.eligibilityDecisions.map((d) => `- ${d}`) : ["None on record."]),
    "",
    "Founder correspondence notes:",
    ...(c.founderCommsNotes.length ? c.founderCommsNotes.map((d) => `- ${d}`) : ["None on record."]),
  ];
  return lines.join("\n");
}
