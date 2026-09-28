import { describe, expect, it } from "vitest";
import {
  ALL_STAGES,
  canDecideEligibility,
  isActiveStage,
  LINEAR_STAGES,
  roundOptionCount,
  stageLabel,
  dealWarnings,
  eoiSummary,
  gatesCrossed,
  latestVotePerAngel,
  MOMENTUM_THRESHOLD_GBP,
} from "./pipeline";

const d = (iso: string) => new Date(iso);

describe("gatesCrossed", () => {
  it("owes nothing when a deal is created", () => {
    expect(gatesCrossed(null, "SUBMITTED")).toEqual([]);
  });

  it("owes the eligibility decision when leaving the eligibility screen", () => {
    expect(gatesCrossed("ELIGIBILITY_SCREEN", "PARTNER_REVIEW")).toEqual([
      { gate: "ELIGIBILITY", decision: "Eligible: proceeding to DXV partner review" },
    ]);
  });

  it("makes DXV Partner Review a decision gate", () => {
    expect(gatesCrossed("PARTNER_REVIEW", "PITCH_SELECTION").map((g) => g.gate)).toEqual(["PARTNER_REVIEW"]);
  });

  it("owes nothing moving between non-gate stages", () => {
    expect(gatesCrossed("SUBMITTED", "ELIGIBILITY_SCREEN")).toEqual([]);
    expect(gatesCrossed("CAPITAL_TRANSFER", "INVESTMENT_COMPLETE")).toEqual([]);
    expect(gatesCrossed("INVESTMENT_COMPLETE", "SEIS_CERTIFICATE")).toEqual([]);
  });

  it("owes nothing when moving on from the retired stage", () => {
    expect(gatesCrossed("ADD_TO_PIPELINE", "PARTNER_REVIEW")).toEqual([]);
  });

  it("owes every gate that gets skipped over", () => {
    expect(gatesCrossed("PITCH_SELECTION", "INVESTMENT_COMMITMENTS").map((g) => g.gate)).toEqual([
      "PITCH_SELECTION",
      "PITCH_OUTCOME",
    ]);
  });

  it("owes nothing when moving backwards or reopening", () => {
    expect(gatesCrossed("DUE_DILIGENCE", "PITCH_OUTCOME")).toEqual([]);
    expect(gatesCrossed("PASSED", "PARTNER_REVIEW")).toEqual([]);
  });

  it("always owes a decline when passing, from any stage", () => {
    expect(gatesCrossed("SUBMITTED", "PASSED", "INELIGIBLE")).toEqual([
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
        { currentStage: "INVESTMENT_COMMITMENTS", stageEnteredAt: d("2026-03-01"), ddItems: [] },
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

describe("stages", () => {
  it("has the ten stages in order, with gates at 2 to 7", () => {
    expect(LINEAR_STAGES.map((s) => s.label)).toEqual([
      "Submitted",
      "Eligibility Screen",
      "DXV Partner Review",
      "Member Pitch Selection",
      "Pitch Outcome",
      "Investment Commitments",
      "Due Diligence",
      "Capital Transfer",
      "Investment Complete",
      "S/EIS Certificate",
    ]);
    expect(LINEAR_STAGES.map((s, i) => (s.gate ? i + 1 : null)).filter(Boolean)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("labels the retired stage for old history, but doesn't offer it", () => {
    expect(stageLabel("ADD_TO_PIPELINE")).toBe("Add to pipeline (retired)");
    expect(ALL_STAGES.some((s) => s.key === "ADD_TO_PIPELINE")).toBe(false);
  });

  it("counts deals as active until Investment Complete", () => {
    expect(isActiveStage("SUBMITTED")).toBe(true);
    expect(isActiveStage("CAPITAL_TRANSFER")).toBe(true);
    expect(isActiveStage("INVESTMENT_COMPLETE")).toBe(false);
    expect(isActiveStage("SEIS_CERTIFICATE")).toBe(false);
    expect(isActiveStage("PASSED")).toBe(false);
  });
});

describe("eligibility decisions", () => {
  it("are only allowed at intake", () => {
    expect(canDecideEligibility("SUBMITTED")).toBe(true);
    expect(canDecideEligibility("ELIGIBILITY_SCREEN")).toBe(true);
    expect(canDecideEligibility("PARTNER_REVIEW")).toBe(false);
    expect(canDecideEligibility("PASSED")).toBe(false);
  });

  it("proceeding from the eligibility screen owes the founder the eligibility decision", () => {
    expect(gatesCrossed("ELIGIBILITY_SCREEN", "PARTNER_REVIEW").map((g) => g.gate)).toEqual(["ELIGIBILITY"]);
  });
});

describe("roundOptionCount", () => {
  it("offers at least 12 rounds, and two beyond the highest in use", () => {
    expect(roundOptionCount(null)).toBe(12);
    expect(roundOptionCount(5)).toBe(12);
    expect(roundOptionCount(14)).toBe(16);
  });
});
