import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONSENT_V1, CONSENT_VERSION } from "./consent-v1";
import { DIVERSITY_QUESTIONS, SELF_DESCRIBE, parseDiversityForm, planDiversitySave, type AnswersByCategory } from "./questions";

const form = (pairs: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of pairs) f.append(k, v);
  return f;
};

describe("consent wording diversity-consent-v1", () => {
  const copy = readFileSync("docs/privacy/consent-copy-and-privacy-notice.md", "utf8").replace(/\*\*/g, "").replace(/\\([[\]])/g, "$1");
  it("is the launch pack's wording, word for word", () => {
    expect(CONSENT_VERSION).toBe("diversity-consent-v1");
    const strings: string[] = [
      CONSENT_V1.heading,
      ...CONSENT_V1.intro,
      CONSENT_V1.howWeUseLabel,
      CONSENT_V1.howWeUse,
      ...Object.values(CONSENT_V1.questions),
      CONSENT_V1.freeTextNote,
      ...Object.values(CONSENT_V1.consentBoxes).map((b) => b.before + b.bold + b.after),
      CONSENT_V1.belowBoxes.before + CONSENT_V1.belowBoxes.bold + CONSENT_V1.belowBoxes.middle,
      CONSENT_V1.belowBoxes.after.trim(),
      CONSENT_V1.saveButton,
      CONSENT_V1.skipButton,
      CONSENT_V1.notSaved,
      CONSENT_V1.profileHeading,
      CONSENT_V1.profileChange,
      CONSENT_V1.profileWithdraw,
      CONSENT_V1.withdrawDone,
      CONSENT_V1.downloadMyData,
      CONSENT_V1.deleteAccount,
    ];
    for (const s of strings) expect(copy, s).toContain(s);
    expect(copy).toContain(CONSENT_V1.disabilityOptions.join(" · "));
  });
});

describe("parseDiversityForm", () => {
  it("treats Prefer not to say (empty) as nothing, and ignores values not on the list", () => {
    const { answers } = parseDiversityForm(form([["q_disability", ""], ["q_religion", "Pastafarian"], ["q_gender", "Woman"]]));
    expect(answers.health).toBeUndefined();
    expect(answers.religion).toBeUndefined();
    expect(answers.gender_background).toEqual([{ question: "gender", value: "Woman", selfDescribed: false }]);
  });
  it("keeps self-described text to one short line, and ignores an empty one", () => {
    const { answers } = parseDiversityForm(form([["q_sexual_orientation", SELF_DESCRIBE], ["q_sexual_orientation_text", "  Queer \n and proud " + "x".repeat(80)]]));
    expect(answers.sexual_orientation?.[0].selfDescribed).toBe(true);
    expect(answers.sexual_orientation?.[0].value.length).toBeLessThanOrEqual(60);
    expect(answers.sexual_orientation?.[0].value).not.toContain("\n");
    expect(parseDiversityForm(form([["q_gender", SELF_DESCRIBE], ["q_gender_text", "  "]])).answers.gender_background).toBeUndefined();
  });
  it("reads one consent box per category, never assumed", () => {
    const { consented } = parseDiversityForm(form([["consent_health", "on"]]));
    expect([...consented]).toEqual(["health"]);
  });
  it("covers every category in the copy", () => {
    expect(new Set(DIVERSITY_QUESTIONS.map((q) => q.category))).toEqual(new Set(["health", "sexual_orientation", "ethnicity", "religion", "gender_background"]));
  });
});

describe("planDiversitySave", () => {
  const woman: AnswersByCategory = { gender_background: [{ question: "gender", value: "Woman", selfDescribed: false }] };
  it("does not save an answer without its consent box", () => {
    expect(planDiversitySave(woman, new Set(), {}, new Set()).gender_background).toBe("refuse");
    expect(planDiversitySave(woman, new Set(["gender_background"]), {}, new Set()).gender_background).toBe("save");
  });
  it("asks for consent again when an answer changes, not when it doesn't", () => {
    const man: AnswersByCategory = { gender_background: [{ question: "gender", value: "Man", selfDescribed: false }] };
    expect(planDiversitySave(woman, new Set(), woman, new Set(["gender_background"])).gender_background).toBe("keep");
    expect(planDiversitySave(man, new Set(), woman, new Set(["gender_background"])).gender_background).toBe("refuse");
    expect(planDiversitySave(man, new Set(["gender_background"]), woman, new Set(["gender_background"])).gender_background).toBe("save");
  });
  it("withdraws when a held answer becomes Prefer not to say", () => {
    expect(planDiversitySave({}, new Set(), woman, new Set(["gender_background"])).gender_background).toBe("withdraw");
    expect(planDiversitySave({}, new Set(), {}, new Set()).health).toBe("none");
  });
});
