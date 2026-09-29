// What the lesson-suggesting AI is shown: the moment, the deal, and the lessons DXV already has.
export type LessonJobContext = {
  ventureName: string;
  moment: string; // e.g. "Declined at Pitch Outcome. Reason: Valuation gap. Note: ..."
  facts: string[]; // deal details, eligibility screen, memo summary, stage history (rendered lines)
  existingLessons: string[]; // titles, so the AI doesn't repeat them
};

export function renderLessonContext(c: LessonJobContext): string {
  return [
    `Deal: ${c.ventureName}`,
    "",
    "The moment:",
    c.moment,
    "",
    "What DXV OS knows about the deal:",
    ...(c.facts.length ? c.facts : ["(little on record)"]),
    "",
    "Lessons DXV already has:",
    ...(c.existingLessons.length ? c.existingLessons.map((t) => `- ${t}`) : ["(none yet)"]),
  ].join("\n");
}
