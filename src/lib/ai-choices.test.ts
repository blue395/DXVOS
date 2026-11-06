import { describe, expect, it } from "vitest";
import { lenientOutputFormat, matchChoice } from "./ai-choices";
import { DeckAnalysisOutputSchema, LenientDeckAnalysisOutputSchema, STAGE_FIT_RATINGS } from "./deck-ai/schema";
import { LenientLessonSuggestionsSchema, LessonSuggestionsSchema } from "./lessons-ai/schema";
import { lenientMemoContentSchema } from "./memo-ai/schema";

describe("fixed choices in AI answers (Sonura, 2026-11-06)", () => {
  it("maps near-misses onto the allowed choice", () => {
    const stage = (s: string) => matchChoice(s, STAGE_FIT_RATINGS, { "series b": "Series A+" });
    expect(stage("Pre-Seed")).toBe("Pre-seed");
    expect(stage("pre seed")).toBe("Pre-seed");
    expect(stage("Pre-seed (pre-revenue)")).toBe("Pre-seed");
    expect(stage("Pre-seed / Seed")).toBe("Pre-seed"); // the longer choice first, so not "Seed"
    expect(stage("SEED")).toBe("Seed");
    expect(stage("Series B")).toBe("Series A+");
    expect(stage("Seedling")).toBeNull();
    expect(stage("")).toBeNull();
  });

  const screen = (rating: unknown, recommendation: unknown = "Proceed to pipeline") => ({
    extracted: {
      name: "Sonura",
      founderNames: null,
      founderEmail: null,
      website: null,
      sector: null,
      companyStage: null,
      raiseAmountGbp: null,
      description: null,
    },
    screen: {
      companyName: "Sonura",
      oneLineSummary: "x",
      recommendation,
      stageFit: { rating, reasoning: "Raising a first round." },
      sector: { name: "Healthtech", note: "" },
      teamStrength: "",
      thesisFit: { rating: "Not stated", reasoning: "" },
      redFlags: [],
      nextStep: "",
      otherCriteria: [],
    },
  });

  it("no longer throws away a whole eligibility screen over one label", () => {
    const format = lenientOutputFormat(DeckAnalysisOutputSchema, LenientDeckAnalysisOutputSchema);
    expect(format.parse(JSON.stringify(screen("Pre-Seed"))).screen.stageFit.rating).toBe("Pre-seed");
    const odd = format.parse(JSON.stringify(screen("Bootstrapped", "Maybe")));
    expect(odd.screen.stageFit).toEqual({ rating: "Unclear", reasoning: 'Raising a first round. (The AI\'s own label was "Bootstrapped".)' });
    expect(odd.screen.recommendation).toBe("Need more information");
    // Still a real check: a broken answer (missing fields) fails as before.
    expect(() => format.parse(JSON.stringify({ extracted: {} }))).toThrow(/Failed to parse structured output/);
  });

  it("still sends Claude the strict schema, choices listed", () => {
    const format = lenientOutputFormat(DeckAnalysisOutputSchema, LenientDeckAnalysisOutputSchema);
    expect(JSON.stringify(format.schema)).toContain("Series A+");
  });

  it("lessons fall back to GENERAL; memo criteria map near-misses but never guess", () => {
    const lessons = lenientOutputFormat(LessonSuggestionsSchema, LenientLessonSuggestionsSchema);
    expect(lessons.parse(JSON.stringify({ lessons: [{ title: "t", body: "b", scope: "Due diligence" }] })).lessons[0].scope).toBe("DUE_DILIGENCE");
    expect(lessons.parse(JSON.stringify({ lessons: [{ title: "t", body: "b", scope: "Fundraising" }] })).lessons[0].scope).toBe("GENERAL");
    const memo = lenientMemoContentSchema(["Market Size", "Team"]);
    const score = (criterion: string) => ({ criterion, score: 3, justification: "r" });
    const base = { scores: [score("market size")] };
    const parsed = memo.shape.scores.safeParse(base.scores);
    expect(parsed.success && parsed.data[0].criterion).toBe("Market Size");
    expect(memo.shape.scores.safeParse([score("Traction")]).success).toBe(false);
  });
});
