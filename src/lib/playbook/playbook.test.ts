import { describe, expect, it } from "vitest";
import { ORIGINAL_MEMO_SYSTEM_PROMPT, ORIGINAL_MEMO_USER_INSTRUCTIONS, ORIGINAL_SCREENING_SYSTEM_PROMPT } from "./__fixtures__/original-prompts";
import { DEFAULT_ASSESSMENT, DEFAULT_ELIGIBILITY } from "./defaults";
import { buildDeckUserInstructions, buildMemoPrompt, buildMemoUserInstructions, buildScreeningPrompt } from "./prompts";
import { AssessmentPlaybookSchema, EligibilityPlaybookSchema } from "./schema";

describe("Playbook version 0", () => {
  it("rebuilds DXV's original prompts exactly", () => {
    expect(buildScreeningPrompt(DEFAULT_ELIGIBILITY)).toBe(ORIGINAL_SCREENING_SYSTEM_PROMPT);
    expect(buildMemoPrompt(DEFAULT_ASSESSMENT)).toBe(ORIGINAL_MEMO_SYSTEM_PROMPT);
    expect(buildMemoUserInstructions(DEFAULT_ASSESSMENT)).toBe(ORIGINAL_MEMO_USER_INSTRUCTIONS);
  });

  it("is valid content", () => {
    expect(EligibilityPlaybookSchema.safeParse(DEFAULT_ELIGIBILITY).success).toBe(true);
    expect(AssessmentPlaybookSchema.safeParse(DEFAULT_ASSESSMENT).success).toBe(true);
  });
});

describe("edited playbooks", () => {
  it("counts and lists the criteria the team defines", () => {
    const p = { ...DEFAULT_ASSESSMENT, criteria: [...DEFAULT_ASSESSMENT.criteria, { id: "x", name: "Founder resilience", anchors: "1: low. 5: high." }] };
    const prompt = buildMemoPrompt(p);
    expect(prompt).toContain("Scoring table — twelve criteria");
    expect(prompt).toContain("12. Founder resilience — 1: low. 5: high.");
    expect(buildMemoUserInstructions(p)).toContain("each of the twelve criteria");
  });

  it("adds extra eligibility criteria to the screen instructions", () => {
    const p = { ...DEFAULT_ELIGIBILITY, criteria: [...DEFAULT_ELIGIBILITY.criteria, { id: "uk", name: "UK company", guidance: "Must be UK registered." }] };
    expect(buildScreeningPrompt(p)).toContain("Screen against these five criteria:");
    expect(buildDeckUserInstructions(p)).toContain('in this order: "UK company"');
    expect(buildDeckUserInstructions(DEFAULT_ELIGIBILITY)).toContain("otherCriteria: an empty list");
  });

  it("appends approved lessons", () => {
    const prompt = buildScreeningPrompt(DEFAULT_ELIGIBILITY, [{ title: "Ask for the cap table early", body: "Two deals stalled in DD on it." }]);
    expect(prompt).toContain("DXV lessons learned");
    expect(prompt).toContain("- Ask for the cap table early: Two deals stalled in DD on it.");
  });

  it("keeps the four core eligibility criteria and unique names", () => {
    const noCore = { ...DEFAULT_ELIGIBILITY, criteria: DEFAULT_ELIGIBILITY.criteria.slice(1) };
    expect(EligibilityPlaybookSchema.safeParse(noCore).success).toBe(false);
    const dup = { ...DEFAULT_ASSESSMENT, criteria: [...DEFAULT_ASSESSMENT.criteria, { id: "d", name: "team", anchors: "x" }] };
    expect(AssessmentPlaybookSchema.safeParse(dup).success).toBe(false);
  });
});
