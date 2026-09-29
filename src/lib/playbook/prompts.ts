// Builds the AI prompts from the Playbook (DXV's criteria, versioned) and approved
// lessons. Version 0 reproduces DXV's original documents exactly (tested).
// Pure; shared with the Netlify workers (relative imports only).
import type { AssessmentPlaybook, EligibilityPlaybook, LessonForAI } from "./schema";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const count = (n: number) => WORDS[n] ?? String(n);
const bulletList = (lines: string[]) => lines.map((l) => `* ${l}`).join("\n");

/** Approved lessons, appended to a system prompt (nothing when there are none). */
export function lessonsSection(lessons: LessonForAI[]): string {
  if (!lessons.length) return "";
  return (
    "\n\nDXV lessons learned\n\nApproved by the DXV team from past deals. Apply them where relevant, and say so when one shapes your assessment:\n\n" +
    lessons.map((l) => `- ${l.title}: ${l.body}`).join("\n")
  );
}

// ── Eligibility screen ──────────────────────────────────────────────────────

export function buildScreeningPrompt(p: EligibilityPlaybook, lessons: LessonForAI[] = []): string {
  return (
    `${p.intro}\n\nScreen against these ${count(p.criteria.length)} criteria:\n\n` +
    p.criteria.map((c, i) => `${i + 1}. ${c.name} — ${c.guidance}`).join("\n") +
    (p.houseStyle.length ? `\n\nHouse style for the output:\n\n${bulletList(p.houseStyle)}` : "") +
    (p.closing ? `\n\n${p.closing}` : "") +
    lessonsSection(lessons)
  );
}

/** Criteria beyond the four core ones: assessed in the screen's "otherCriteria" list. */
export const extraEligibilityCriteria = (p: EligibilityPlaybook) => p.criteria.filter((c) => !c.core);

export function buildDeckUserInstructions(p: EligibilityPlaybook): string {
  const extra = extraEligibilityCriteria(p);
  const coreName = (core: string) => p.criteria.find((c) => c.core === core)?.name ?? core;
  const other = extra.length
    ? `   - otherCriteria: one entry for each of DXV's additional criteria, in this order: ${extra.map((c) => `"${c.name}"`).join(", ")}. criterion is its name exactly; assessment is one line: met, not met or unclear, and why`
    : "   - otherCriteria: an empty list (DXV has no additional criteria)";
  return `The attached PDF is the founder deck. Produce two things.

1. "extracted": details for DXV's Venture record, taken from the deck. Only fill a field when the deck states it. Use null when it isn't stated; never guess an email address, website, or amount.
   - name: company name
   - founderNames: founder name(s) as written in the deck, comma-separated
   - founderEmail: a contact email if one is shown
   - website: the company website as a full URL starting with https:// if one is shown
   - sector: short sector label, e.g. "Fintech", "Healthtech"
   - companyStage: one of "Pre-Seed", "Seed", "Series A", "Bridge Round", or the stage as written if it is none of these; only if the deck states it or states the round being raised
   - raiseAmountGbp: amount being raised, in whole pounds, only if stated in GBP (null if another currency or not stated)
   - description: two or three plain sentences on what the company does and for whom

2. "screen": your eligibility screen, following the system prompt. Field by field:
   - recommendation: "Proceed to pipeline", "Decline" or "Need more information"
   - stageFit.rating and thesisFit.rating: one of the allowed values; the matching reasoning is one line (stageFit is "${coreName("stageFit")}", thesisFit is "${coreName("thesisFit")}")
   - sector.note: any obvious viability concern, or "No concern" (the "${coreName("sector")}" criterion)
   - teamStrength: one to two lines; say plainly if the deck has no team information
   - redFlags: anything that should stop this proceeding automatically; an empty list if none
   - nextStep: "Proceed to DXV partner review", "Decline: <reason>", or "Request from founder: <specific missing item>"
${other}
   A "Not stated" thesis fit alone is never a reason to decline: recommend asking the founder instead.`;
}

// ── Investment assessment ───────────────────────────────────────────────────

export function buildMemoPrompt(p: AssessmentPlaybook, lessons: LessonForAI[] = []): string {
  const n = count(p.criteria.length);
  return (
    `${p.intro}

Produce the memo in exactly this structure, matching DXV's existing template:

1. Header: Business name, Round, Stage, Business model, SDGs, Impact thesis
2. Executive Summary
3. Investment Case (bullet points — the strongest, most specific reasons this is attractive)
4. Conclusion (a one- or two-line risk/return characterisation and who among DXV's angels it's suited to)
5. Scoring table — ${n} criteria, each scored out of 5, each with a one- to two-sentence justification (see §2 for scoring anchors)
6. SWOT Summary (Strengths, Weaknesses, Opportunities, Threats)
7. Key Follow-Up Questions for Founders` +
    (p.houseStyle.length ? `\n\nHouse style, same as every other DXV document:\n\n${bulletList(p.houseStyle)}` : "") +
    `

§2. Scoring anchors (for consistency across ventures)

Each of the ${n} criteria below is scored 1 to 5. Use these anchors so scores mean roughly the same thing from one memo to the next, rather than reflecting how impressed the model happened to be by the deck's design.

${p.criteria.map((c, i) => `${i + 1}. ${c.name} — ${c.anchors}`).join("\n")}

§3. DXV's actual impact and diversity taxonomy

Use these tags, drawn from DXV's own deal tracker, not a generic diversity list:

Impact Theme (examples DXV has actually used): ${p.impactThemes.length ? `${p.impactThemes.join(", ")}, and others` : "none listed; use themes"} as the deck warrants — don't force a fit if none of these apply.

Diversity Theme: ${p.diversityThemes.join(", ")}.` +
    (p.taxonomyGuidance ? `\n\n${p.taxonomyGuidance}` : "") +
    lessonsSection(lessons)
  );
}

export function buildMemoUserInstructions(p: AssessmentPlaybook): string {
  return `The attached PDF is the founder deck. The "DXV OS context" above is what DXV already knows about this venture (deal details, the eligibility screen, and partner notes); use it as source material, and prefer it where it is more recent than the deck.

Fill the memo fields as follows:
- header.businessName, header.stage (company stage, e.g. "Pre-seed"), header.businessModel (one line)
- header.round: copy the "DXV round" value from the context exactly
- header.sdgs: the UN Sustainable Development Goals the venture credibly contributes to, as "SDG 3: Good health and well-being" etc. Empty if none apply.
- header.impactThesis: one or two sentences; include "not stated" for founder background where it isn't stated
- header.impactThemes: tags from the Impact Theme list (or others as the deck warrants); empty if none fit
- header.diversityThemes: only tags stated directly in the deck or correspondence; empty if none are stated
- executiveSummary: one short paragraph
- investmentCase: bullet points, strongest and most specific first; put any material risk here or in the conclusion
- conclusion: one or two lines
- scores: exactly one entry for each of the ${count(p.criteria.length)} criteria, using the criterion names exactly as listed, each an integer 1 to 5 with a one- to two-sentence justification
- swot: short bullet points under each heading
- followUpQuestions: specific questions for the founders, including founder background if not stated`;
}
