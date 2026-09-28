import { describe, expect, it } from "vitest";
import {
  ALL_STAGES,
  canDecideEligibility,
  canGenerateAssessment,
  canCreateDDDocument,
  cardOneLiner,
  formatGbpCompact,
  stagePhase,
  dashboardMetrics,
  isActiveStage,
  LINEAR_STAGES,
  parseRoundFilter,
  roundOptionCount,
  stageLabel,
  dealWarnings,
  commitmentTotal,
  gatesCrossed,
  latestVotePerAngel,
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

describe("commitmentTotal", () => {
  it("sums each angel's latest interested vote", () => {
    const t = commitmentTotal([
      { angelName: "A", interested: true, maxTicketGbp: 15_000, createdAt: d("2026-03-02") },
      { angelName: "A", interested: true, maxTicketGbp: 10_000, createdAt: d("2026-03-03") }, // supersedes
      { angelName: "B", interested: true, maxTicketGbp: 10_000, createdAt: d("2026-03-04") },
      { angelName: "C", interested: false, maxTicketGbp: 50_000, createdAt: d("2026-03-04") },
      { angelName: "D", interested: true, maxTicketGbp: 5_000, createdAt: d("2026-03-01") },
      { angelName: "D", interested: false, maxTicketGbp: 0, createdAt: d("2026-03-05") }, // withdrew
    ]);
    expect(t).toEqual({ totalGbp: 20_000, interestedCount: 2 });
  });
});

describe("dealWarnings", () => {
  it("flags a deal stalled in Investment Commitments", () => {
    expect(
      dealWarnings(
        { currentStage: "INVESTMENT_COMMITMENTS", stageEnteredAt: d("2026-03-01"), ddItems: [] },
        d("2026-03-10"),
      ),
    ).toEqual(["In Investment Commitments for over 7 days"]);
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

describe("parseRoundFilter", () => {
  it("reads a round number, 'none', or falls back to all", () => {
    expect(parseRoundFilter("3")).toEqual({ kind: "round", round: 3 });
    expect(parseRoundFilter("none")).toEqual({ kind: "none" });
    expect(parseRoundFilter(undefined)).toEqual({ kind: "all" });
    expect(parseRoundFilter("abc")).toEqual({ kind: "all" });
    expect(parseRoundFilter("0")).toEqual({ kind: "all" });
    expect(parseRoundFilter("2.5")).toEqual({ kind: "all" });
    expect(parseRoundFilter(["4", "5"])).toEqual({ kind: "round", round: 4 });
  });
});

describe("dashboardMetrics", () => {
  it("counts live, in-DD and invested deals, and sums invested amounts", () => {
    const m = dashboardMetrics([
      { currentStage: "SUBMITTED", investedAmountGbp: null },
      { currentStage: "DUE_DILIGENCE", investedAmountGbp: null },
      { currentStage: "CAPITAL_TRANSFER", investedAmountGbp: null },
      { currentStage: "INVESTMENT_COMPLETE", investedAmountGbp: 50_000 },
      { currentStage: "SEIS_CERTIFICATE", investedAmountGbp: 75_000 },
      { currentStage: "INVESTMENT_COMPLETE", investedAmountGbp: null }, // amount not entered yet
      { currentStage: "PASSED", investedAmountGbp: null },
    ]);
    expect(m).toEqual({ liveDeals: 3, inDueDiligence: 1, investments: 3, investedTotalGbp: 125_000 });
  });

  it("ignores amounts on deals that aren't invested", () => {
    expect(dashboardMetrics([{ currentStage: "PASSED", investedAmountGbp: 10_000 }]).investedTotalGbp).toBe(0);
  });
});

describe("board presentation", () => {
  it("groups stages into phases", () => {
    expect(stagePhase("SUBMITTED")).toBe("intake");
    expect(stagePhase("ELIGIBILITY_SCREEN")).toBe("intake");
    expect(stagePhase("PARTNER_REVIEW")).toBe("review");
    expect(stagePhase("PITCH_OUTCOME")).toBe("review");
    expect(stagePhase("INVESTMENT_COMMITMENTS")).toBe("closing");
    expect(stagePhase("CAPITAL_TRANSFER")).toBe("closing");
    expect(stagePhase("INVESTMENT_COMPLETE")).toBe("invested");
    expect(stagePhase("SEIS_CERTIFICATE")).toBe("invested");
    expect(stagePhase("PASSED")).toBe("passed");
  });

  it("formats money compactly", () => {
    expect(formatGbpCompact(950)).toBe("£950");
    expect(formatGbpCompact(7_500)).toBe("£7.5k");
    expect(formatGbpCompact(400_000)).toBe("£400k");
    expect(formatGbpCompact(1_800_000)).toBe("£1.8m");
    expect(formatGbpCompact(1_250_000)).toBe("£1.25m");
  });

  it("prefers the AI one-line summary, else the description's first sentence", () => {
    expect(cardOneLiner("Booking marketplace for families.", "Long text. More.")).toBe("Booking marketplace for families.");
    expect(cardOneLiner(null, "Refill packs for personal care. We sell online.")).toBe("Refill packs for personal care.");
    expect(cardOneLiner(null, "No full stop here")).toBe("No full stop here");
    expect(cardOneLiner(null, "  ")).toBeNull();
    expect(cardOneLiner(null, "x".repeat(200))!.length).toBe(118);
  });
});

describe("canGenerateAssessment", () => {
  it("is available from DXV Partner Review onwards, not at intake or once passed", () => {
    expect(canGenerateAssessment("SUBMITTED")).toBe(false);
    expect(canGenerateAssessment("ELIGIBILITY_SCREEN")).toBe(false);
    expect(canGenerateAssessment("PARTNER_REVIEW")).toBe(true);
    expect(canGenerateAssessment("DUE_DILIGENCE")).toBe(true);
    expect(canGenerateAssessment("PASSED")).toBe(false);
  });
});

describe("canCreateDDDocument", () => {
  it("follows the assessment rule", () => {
    expect(canCreateDDDocument("ELIGIBILITY_SCREEN")).toBe(false);
    expect(canCreateDDDocument("INVESTMENT_COMMITMENTS")).toBe(true);
    expect(canCreateDDDocument("DUE_DILIGENCE")).toBe(true);
    expect(canCreateDDDocument("PASSED")).toBe(false);
  });
});
