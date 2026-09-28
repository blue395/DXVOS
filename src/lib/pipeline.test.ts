import { describe, expect, it } from "vitest";
import {
  canDecideEligibility,
  dealWarnings,
  eoiSummary,
  gatesCrossed,
  latestVotePerAngel,
  MOMENTUM_THRESHOLD_GBP,
} from "./pipeline";

const d = (iso: string) => new Date(iso);

describe("gatesCrossed", () => {
  it("owes nothing when a deal is created", () => {
    expect(gatesCrossed(null, "FOUNDER_DECK")).toEqual([]);
  });

  it("owes the eligibility decision when leaving eligibility screening", () => {
    expect(gatesCrossed("ELIGIBILITY_SCREENING", "ADD_TO_PIPELINE")).toEqual([
      { gate: "ELIGIBILITY", decision: "Proceed" },
    ]);
  });

  it("owes nothing moving between non-gate stages", () => {
    expect(gatesCrossed("ADD_TO_PIPELINE", "INTERNAL_REVIEW")).toEqual([]);
  });

  it("owes every gate that gets skipped over", () => {
    expect(gatesCrossed("PITCH_SELECTION", "INVESTMENT_VOTES").map((g) => g.gate)).toEqual([
      "PITCH_SELECTION",
      "PITCH_OUTCOME",
    ]);
  });

  it("owes nothing when moving backwards or reopening", () => {
    expect(gatesCrossed("DUE_DILIGENCE", "PITCH_OUTCOME")).toEqual([]);
    expect(gatesCrossed("PASSED", "ADD_TO_PIPELINE")).toEqual([]);
  });

  it("always owes a decline when passing, from any stage", () => {
    expect(gatesCrossed("FOUNDER_DECK", "PASSED", "INELIGIBLE")).toEqual([
      { gate: "PASSED", decision: "Decline — Ineligible" },
    ]);
  });
});

describe("latestVotePerAngel", () => {
  it("keeps only each angel's most recent vote, matching names loosely", () => {
    const votes = [
      { angelName: "Ada Lovelace", createdAt: d("2026-01-01"), v: 1 },
      { angelName: " ada  lovelace ", createdAt: d("2026-01-03"), v: 2 },
      { angelName: "Grace Hopper", createdAt: d("2026-01-02"), v: 3 },
    ];
    expect(latestVotePerAngel(votes).map((x) => x.v).sort()).toEqual([2, 3]);
  });
});

describe("eoiSummary", () => {
  const start = d("2026-03-01T10:00:00Z");

  it("meets the threshold on latest interested votes inside the window", () => {
    const s = eoiSummary(
      [
        { angelName: "A", interested: true, maxTicketGbp: 15_000, createdAt: d("2026-03-02") },
        { angelName: "A", interested: true, maxTicketGbp: 10_000, createdAt: d("2026-03-03") }, // supersedes
        { angelName: "B", interested: true, maxTicketGbp: 10_000, createdAt: d("2026-03-04") },
        { angelName: "C", interested: false, maxTicketGbp: 50_000, createdAt: d("2026-03-04") },
      ],
      start,
      d("2026-03-05"),
    );
    expect(s.withinWindowGbp).toBe(20_000);
    expect(s.thresholdMet).toBe(true);
    expect(s.interestedCount).toBe(2);
    expect(s.windowOpen).toBe(true);
  });

  it("does not count votes cast after the window towards the threshold", () => {
    const s = eoiSummary(
      [{ angelName: "A", interested: true, maxTicketGbp: MOMENTUM_THRESHOLD_GBP, createdAt: d("2026-03-20") }],
      start,
      d("2026-03-21"),
    );
    expect(s.totalGbp).toBe(MOMENTUM_THRESHOLD_GBP);
    expect(s.withinWindowGbp).toBe(0);
    expect(s.thresholdMet).toBe(false);
    expect(s.windowOpen).toBe(false);
  });
});

describe("dealWarnings", () => {
  it("flags a deal stalled past the EOI window", () => {
    expect(
      dealWarnings(
        { currentStage: "INVESTMENT_VOTES", stageEnteredAt: d("2026-03-01"), ddItems: [] },
        d("2026-03-10"),
      ),
    ).toEqual(["Stalled past the EOI window"]);
  });

  it("flags an overdue, incomplete DD item", () => {
    expect(
      dealWarnings(
        {
          currentStage: "DUE_DILIGENCE",
          stageEnteredAt: d("2026-03-01"),
          ddItems: [
            { dueDate: d("2026-03-05"), completedAt: null },
            { dueDate: d("2026-03-04"), completedAt: d("2026-03-04") },
          ],
        },
        d("2026-03-10"),
      ),
    ).toEqual(["Overdue DD item"]);
  });
});

describe("eligibility decisions", () => {
  it("are only allowed at intake", () => {
    expect(canDecideEligibility("FOUNDER_DECK")).toBe(true);
    expect(canDecideEligibility("ELIGIBILITY_SCREENING")).toBe(true);
    expect(canDecideEligibility("ADD_TO_PIPELINE")).toBe(false);
    expect(canDecideEligibility("PASSED")).toBe(false);
  });

  it("proceeding from eligibility owes the founder the eligibility decision", () => {
    expect(gatesCrossed("ELIGIBILITY_SCREENING", "ADD_TO_PIPELINE").map((g) => g.gate)).toEqual(["ELIGIBILITY"]);
  });
});
