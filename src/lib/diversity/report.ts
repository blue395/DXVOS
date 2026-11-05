// Aggregate diversity reporting with the small-number rule enforced in code
// (docs/privacy/launch-pack.md, "Small-number rule for reports"). Pure, tested in
// report.test.ts. Everything shown to the team goes through here: no figure for a group of
// fewer than 10 people, no breakdown that lets a hidden group be worked out by subtraction,
// and no cross-tab unless every cell has at least 10.

export const SMALL_NUMBER = 10;

/** Panel titles for each question (team reports). */
export const DIVERSITY_REPORT_LABELS: Record<string, string> = {
  disability: "Disability or neurodivergence",
  sexual_orientation: "Sexual orientation",
  ethnic_group: "Ethnic group",
  religion: "Religion or belief",
  gender: "Gender",
  state_school: "School",
  first_gen_university: "First in family to university",
  life_experience: "Life experience",
};
export const FEWER = "fewer than 10" as const;
export type Cell = number | typeof FEWER;

export type RawCount = { question: string; value: string; n: number; respondents: number };
export type QuestionReport = { question: string; respondents: Cell; rows: { value: string; count: Cell }[]; hidden: boolean };

const cell = (n: number): Cell => (n < SMALL_NUMBER ? FEWER : n);

/**
 * One table per question (single characteristics only). If fewer than 10 people answered a
 * question, nothing about it is shown. If exactly one group is under 10, the next smallest
 * is hidden too, so the hidden one can't be found by subtracting from the total.
 */
export function singleCharacteristicReport(raw: RawCount[]): QuestionReport[] {
  const byQuestion = new Map<string, RawCount[]>();
  for (const r of raw) byQuestion.set(r.question, [...(byQuestion.get(r.question) ?? []), r]);
  return [...byQuestion.entries()].map(([question, rows]) => {
    const respondents = Math.max(...rows.map((r) => r.respondents));
    if (respondents < SMALL_NUMBER) return { question, respondents: FEWER, rows: [], hidden: true };
    const sorted = [...rows].sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
    const out = sorted.map((r) => ({ value: r.value, count: cell(r.n) }));
    const suppressed = out.filter((r) => r.count === FEWER).length;
    if (suppressed === 1) {
      // Complementary suppression: hide the smallest group still showing a number.
      const shown = out.filter((r) => r.count !== FEWER);
      const smallest = shown[shown.length - 1];
      if (smallest) smallest.count = FEWER;
    }
    return { question, respondents, rows: out, hidden: false };
  });
}

/** How many members gave one particular answer, under the same rule (e.g. the Female members figure). */
export function countOf(raw: RawCount[], question: string, value: string): Cell {
  return cell(raw.find((r) => r.question === question && r.value === value)?.n ?? 0);
}

/**
 * A cross-tab of two characteristics, only if EVERY cell (including empty combinations)
 * has at least 10 people; otherwise nothing.
 */
export function crossTab(rows: { a: string; b: string; n: number }[], aValues: string[], bValues: string[]): { allowed: true; cells: Record<string, Record<string, number>> } | { allowed: false } {
  const cells: Record<string, Record<string, number>> = {};
  for (const a of aValues) {
    cells[a] = {};
    for (const b of bValues) {
      const n = rows.filter((r) => r.a === a && r.b === b).reduce((s, r) => s + r.n, 0);
      if (n < SMALL_NUMBER) return { allowed: false };
      cells[a][b] = n;
    }
  }
  return { allowed: true, cells };
}

/**
 * Members' combined figures under the same headings DXV uses for founders (Kevin's wording,
 * 2026-11-05), worked out from the questions members already answer. Members aren't asked
 * their age, so there's no "over 50" heading. Self-described answers aren't counted (they
 * can't be sorted reliably).
 */
export const MEMBER_HEADLINES: { label: string; question: string; values: string[] }[] = [
  { label: "Female", question: "gender", values: ["Woman"] },
  {
    label: "Person of Colour",
    question: "ethnic_group",
    values: [
      "Indian",
      "Pakistani",
      "Bangladeshi",
      "Chinese",
      "Any other Asian background",
      "Caribbean",
      "African",
      "Any other Black, Black British or Caribbean background",
      "White and Black Caribbean",
      "White and Black African",
      "White and Asian",
      "Any other Mixed or multiple ethnic background",
      "Arab",
      "Any other ethnic group",
    ],
  },
  { label: "Neurodivergent", question: "disability", values: ["Yes, neurodivergent", "Yes, both"] },
  { label: "Disabled", question: "disability", values: ["Yes, disability", "Yes, both"] },
  { label: "From a socio-economic disadvantaged background", question: "life_experience", values: ["I grew up in a low-income household"] },
  { label: "LGBTQIA+", question: "sexual_orientation", values: ["Gay or lesbian", "Bisexual"] },
];

/**
 * The headline figures, under the small-number rule. A heading is a sum of answers to one
 * question, so it's shown only when every answer it adds up is already shown in that
 * question's table (and the sum is 10 or more): it never reveals a hidden group, even by
 * subtracting one heading from another.
 */
export function memberHeadlines(raw: RawCount[]): { label: string; count: Cell }[] {
  const reports = new Map(singleCharacteristicReport(raw).map((r) => [r.question, r]));
  return MEMBER_HEADLINES.map((h) => {
    const report = reports.get(h.question);
    if (!report || report.hidden) return { label: h.label, count: FEWER };
    const rows = report.rows.filter((r) => h.values.includes(r.value));
    if (rows.some((r) => r.count === FEWER)) return { label: h.label, count: FEWER };
    return { label: h.label, count: cell(rows.reduce((n, r) => n + (r.count as number), 0)) };
  });
}
