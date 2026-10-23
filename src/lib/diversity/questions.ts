// Members' diversity questions and the save rules (Blue, 2026-10-23; docs/privacy).
// Pure (no server imports), unit-tested in questions.test.ts.
//
// Wording comes verbatim from consent-v1.ts. The option lists marked "DXV addition" fill
// the copy's "[list]" / "[options]" placeholders: the ONS 2021 census lists, and the
// background items moved from the old "About you" pills. Confirm them with Kevin/Blue.
//
// Rules from the copy: every question optional; "Prefer not to say" is the default and is
// stored as NOTHING; one consent box per category; an answer without its box is not saved.

import { CONSENT_V1 } from "./consent-v1";

export type DiversityCategory = "health" | "sexual_orientation" | "ethnicity" | "religion" | "gender_background";
export const DIVERSITY_CATEGORIES: DiversityCategory[] = ["health", "sexual_orientation", "ethnicity", "religion", "gender_background"];

/** Short names, for the member's own pages (consent history, download). */
export const CATEGORY_LABELS: Record<DiversityCategory, string> = {
  health: "Disability or neurodivergence",
  sexual_orientation: "Sexual orientation",
  ethnicity: "Ethnic group",
  religion: "Religion or belief",
  gender_background: "Gender and background",
};

export type OptionGroup = { label?: string; options: string[] };
export type Question = {
  key: string;
  category: DiversityCategory;
  label: string;
  /** single: one choice (or self-describe); multi: tick any (none ticked = prefer not to say). */
  kind: "single" | "multi";
  groups: OptionGroup[];
  selfDescribe?: boolean;
  /** Shown under the label (DXV additions only). */
  hint?: string;
};

export const SELF_DESCRIBE = "__self__";
export const SELF_MAX = 60;

export const DIVERSITY_QUESTIONS: Question[] = [
  { key: "disability", category: "health", label: CONSENT_V1.questions.disability, kind: "single", groups: [{ options: [...CONSENT_V1.disabilityOptions] }] },
  {
    key: "sexual_orientation",
    category: "sexual_orientation",
    label: CONSENT_V1.questions.sexualOrientation,
    kind: "single",
    // DXV addition: ONS 2021 census list.
    groups: [{ options: ["Straight or heterosexual", "Gay or lesbian", "Bisexual"] }],
    selfDescribe: true,
  },
  {
    key: "ethnic_group",
    category: "ethnicity",
    label: CONSENT_V1.questions.ethnicGroup,
    kind: "single",
    // DXV addition: ONS 2021 census list (England and Wales).
    groups: [
      { label: "Asian or Asian British", options: ["Indian", "Pakistani", "Bangladeshi", "Chinese", "Any other Asian background"] },
      { label: "Black, Black British, Caribbean or African", options: ["Caribbean", "African", "Any other Black, Black British or Caribbean background"] },
      { label: "Mixed or multiple ethnic groups", options: ["White and Black Caribbean", "White and Black African", "White and Asian", "Any other Mixed or multiple ethnic background"] },
      { label: "White", options: ["English, Welsh, Scottish, Northern Irish or British", "Irish", "Gypsy or Irish Traveller", "Roma", "Any other White background"] },
      { label: "Other ethnic group", options: ["Arab", "Any other ethnic group"] },
    ],
    selfDescribe: true,
  },
  {
    key: "religion",
    category: "religion",
    label: CONSENT_V1.questions.religion,
    kind: "single",
    // DXV addition: ONS 2021 census list, plus "None" from the copy.
    groups: [{ options: ["Christian", "Buddhist", "Hindu", "Jewish", "Muslim", "Sikh", "Any other religion or belief", CONSENT_V1.religionNone] }],
  },
  {
    key: "gender",
    category: "gender_background",
    label: CONSENT_V1.questions.gender,
    kind: "single",
    // DXV addition.
    groups: [{ options: ["Woman", "Man", "Non-binary"] }],
    selfDescribe: true,
  },
  // The copy's single background question, asked as two parts plus the items Blue moved
  // from the old pills (DXV additions).
  {
    key: "state_school",
    category: "gender_background",
    label: CONSENT_V1.questions.background,
    kind: "single",
    hint: "School",
    groups: [{ options: ["Yes, a state school", "No, a fee-paying school", "I went to school outside the UK"] }],
  },
  {
    key: "first_gen_university",
    category: "gender_background",
    label: "",
    kind: "single",
    hint: "University",
    groups: [{ options: ["Yes, I'm the first in my family to go to university", "No", "I didn't go to university"] }],
  },
  {
    key: "life_experience",
    category: "gender_background",
    label: "",
    kind: "multi",
    hint: "Any of these (tick any that apply; leave blank if you'd prefer not to say)",
    groups: [{ options: ["I've been in care", "I've experienced homelessness", "I grew up in a low-income household", "I moved to the UK from another country"] }],
  },
];

export type DiversityAnswerInput = { question: string; value: string; selfDescribed: boolean };
export type AnswersByCategory = Partial<Record<DiversityCategory, DiversityAnswerInput[]>>;

const questionByKey = new Map(DIVERSITY_QUESTIONS.map((q) => [q.key, q]));
const allOptions = (q: Question) => q.groups.flatMap((g) => g.options);

type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

/**
 * The answers and consent boxes from the consent form. Anything not on a question's list
 * is ignored (never trusted), "Prefer not to say" (an empty value) stores nothing, and
 * self-described text is trimmed to one line of at most SELF_MAX characters.
 */
export function parseDiversityForm(f: FormLike): { answers: AnswersByCategory; consented: Set<DiversityCategory> } {
  const answers: AnswersByCategory = {};
  for (const q of DIVERSITY_QUESTIONS) {
    const picked = (q.kind === "multi" ? f.getAll(`q_${q.key}`) : [f.get(`q_${q.key}`)]).map((v) => (typeof v === "string" ? v : ""));
    for (const v of new Set(picked)) {
      let a: DiversityAnswerInput | null = null;
      if (v === SELF_DESCRIBE && q.selfDescribe) {
        const text = String(f.get(`q_${q.key}_text`) ?? "").replace(/\s+/g, " ").trim().slice(0, SELF_MAX);
        if (text) a = { question: q.key, value: text, selfDescribed: true };
      } else if (v && allOptions(q).includes(v)) {
        a = { question: q.key, value: v, selfDescribed: false };
      }
      if (a) (answers[q.category] ??= []).push(a);
    }
  }
  const consented = new Set(DIVERSITY_CATEGORIES.filter((c) => f.get(`consent_${c}`) === "on"));
  return { answers, consented };
}

const keyOf = (list: DiversityAnswerInput[] = []) =>
  list
    .map((a) => `${a.question}\u0000${a.selfDescribed ? "s" : "o"}\u0000${a.value}`)
    .sort()
    .join("\u0001");

export type CategoryPlan = "keep" | "save" | "refuse" | "withdraw" | "none";

/**
 * What to do with each category on save:
 *   keep: unchanged, consent already given (no need to confirm again);
 *   save: new or changed answers WITH the box ticked (consent recorded, answers replaced);
 *   refuse: new or changed answers WITHOUT the box: nothing is saved (show CONSENT_V1.notSaved);
 *   withdraw: now "Prefer not to say" where answers were held: delete them, consent withdrawn;
 *   none: nothing answered, nothing held.
 */
export function planDiversitySave(
  submitted: AnswersByCategory,
  consented: Set<DiversityCategory>,
  saved: AnswersByCategory,
  consentGiven: Set<DiversityCategory>,
): Record<DiversityCategory, CategoryPlan> {
  const out = {} as Record<DiversityCategory, CategoryPlan>;
  for (const c of DIVERSITY_CATEGORIES) {
    const now = submitted[c] ?? [];
    const before = saved[c] ?? [];
    if (!now.length) out[c] = before.length || consentGiven.has(c) ? "withdraw" : "none";
    else if (keyOf(now) === keyOf(before) && consentGiven.has(c)) out[c] = "keep";
    else out[c] = consented.has(c) ? "save" : "refuse";
  }
  return out;
}

/** Group stored rows by category (for the plan and for showing them). */
export function byCategory(rows: (DiversityAnswerInput & { category: DiversityCategory })[]): AnswersByCategory {
  const out: AnswersByCategory = {};
  for (const r of rows) (out[r.category] ??= []).push({ question: r.question, value: r.value, selfDescribed: r.selfDescribed });
  return out;
}

/** A stored value as the form shows it: an option, or self-described text. */
export function formValueFor(q: Question, rows: DiversityAnswerInput[]): { picked: string[]; selfText: string } {
  const mine = rows.filter((r) => r.question === q.key);
  const self = mine.find((r) => r.selfDescribed || !allOptions(q).includes(r.value));
  return {
    picked: mine.filter((r) => !r.selfDescribed && allOptions(q).includes(r.value)).map((r) => r.value).concat(self && q.selfDescribe ? [SELF_DESCRIBE] : []),
    selfText: self && q.selfDescribe ? self.value : "",
  };
}

export const questionFor = (key: string) => questionByKey.get(key);
