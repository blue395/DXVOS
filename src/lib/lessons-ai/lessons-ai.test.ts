import { describe, expect, it } from "vitest";
import { analyzeMemo } from "../memo-ai/analyze";
import { fakeMemoClient } from "../memo-ai/mock";
import { DEFAULT_ASSESSMENT } from "../playbook/defaults";
import { suggestLessons } from "./analyze";
import type { LessonJobContext } from "./context";
import { fakeLessonClient } from "./mock";
import { LessonSuggestionError } from "./schema";

const context: LessonJobContext = {
  ventureName: "Papcup",
  moment: "Declined at Pitch Outcome. Reason: Valuation gap.",
  facts: ["Sector: Healthtech."],
  existingLessons: ["Ask for the cap table early"],
};

describe("suggestLessons", () => {
  it("sends the moment, the deal and existing lessons; caps and cleans suggestions", async () => {
    let sent = "";
    const many = Array.from({ length: 5 }, (_, i) => ({ title: `Lesson ${i} — sharp`, body: "Check X → Y.", scope: "GENERAL" as const }));
    const r = await suggestLessons(fakeLessonClient({ lessons: many, onRequest: (p) => (sent = JSON.stringify(p)) }), context);
    expect(sent).toContain("Declined at Pitch Outcome");
    expect(sent).toContain("Ask for the cap table early");
    expect(r.lessons).toHaveLength(3);
    expect(r.lessons[0].title).not.toMatch(/—/);
    expect(r.lessons[0].body).toBe("Check X to Y.");
  });

  it("allows no suggestions, and reports refusals", async () => {
    expect((await suggestLessons(fakeLessonClient({ lessons: [] }), context)).lessons).toEqual([]);
    await expect(suggestLessons(fakeLessonClient({ stopReason: "refusal" }), context)).rejects.toThrow(LessonSuggestionError);
  });
});

describe("assessment with edited criteria", () => {
  it("scores the criteria the Playbook version lists, out of their own maximum", async () => {
    const playbook = { ...DEFAULT_ASSESSMENT, criteria: [...DEFAULT_ASSESSMENT.criteria.slice(0, 3), { id: "r", name: "Founder resilience", anchors: "1: low. 5: high." }] };
    let system = "";
    const r = await analyzeMemo(
      fakeMemoClient({ onRequest: (p) => (system = (p as { system: string }).system) }),
      Buffer.from("%PDF"),
      {
        ventureName: "Papcup",
        dxvRound: "Round 1",
        details: {},
        eligibilityScreen: null,
        eligibilityDecisions: [],
        founderCommsNotes: [],
        deck: null,
        ai: { playbookVersion: 2, playbook, lessons: [{ title: "Weigh traction over polish", body: "Decks can over-sell." }] },
      },
    );
    expect(system).toContain("Scoring table — four criteria");
    expect(system).toContain("- Weigh traction over polish: Decks can over-sell.");
    expect(r.memo.scores.map((s) => s.criterion)).toEqual(["Team", "Problem Solution fit", "Mkt & scalability", "Founder resilience"]);
  });
});
