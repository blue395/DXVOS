import { describe, expect, it } from "vitest";
import {
  angelDealPhase,
  angelDealVisibility,
  angelSeesDocument,
  angelDdOpen,
  committedAngelIds,
  teamRevokeBlock,
  memberBoardCards,
  parseMoneyMinor,
  formatMoneyMinor,
  holdingMultiple,
  portfolioSummary,
  portfolioDates,
  reliefHoldingEnds,
  angelSeesMemo,
  angelVoteKind,
  nextOnboardingStep,
  portalState,
  angelTotals,
  canSeeLiveDeals,
  certificationExpiry,
  certNeedsAction,
  certState,
  findDuplicateAngels,
  latestCertification,
  matchesAngelFilter,
  parseList,
  resolveAngelId,
  suggestAngelMatch,
  dealsByStage,
  deckCardState,
  ALL_STAGES,
  canDecideEligibility,
  canGenerateAssessment,
  canCreateDDDocument,
  advanceTarget,
  focusSections,
  finalInvestmentTotals,
  canDecline,
  BOARD_STAGES,
  boardColumn,
  boardHref,
  normaliseCompanyStage,
  eligibilityDisagrees,
  splitLatestComm,
  parseDeclinedFilter,
  declinedColumn,
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
    expect(gatesCrossed("DUE_DILIGENCE", "INVESTMENT_COMPLETE").map((g) => g.gate)).toEqual(["DUE_DILIGENCE"]);
    expect(gatesCrossed("CAPITAL_TRANSFER", "INVESTMENT_COMPLETE")).toEqual([]); // retired stage
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

  it("always owes a decline when declining, naming where it was declined", () => {
    expect(gatesCrossed("SUBMITTED", "PASSED", "INELIGIBLE")).toEqual([
      { gate: "PASSED", decision: "Declined at Submitted: Ineligible" },
    ]);
    expect(gatesCrossed("PITCH_OUTCOME", "PASSED", "VALUATION_GAP")[0].decision).toBe("Declined at Pitch Outcome: Valuation gap");
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
  it("has the nine stages in order, with gates at 2 to 7 (Capital Transfer retired)", () => {
    expect(LINEAR_STAGES.map((s) => s.label)).toEqual([
      "Submitted",
      "Eligibility Screen",
      "DXV Partner Review",
      "Member Pitch Selection",
      "Pitch Outcome",
      "Investment Commitments",
      "Due Diligence",
      "Investment Complete",
      "S/EIS Certificate",
    ]);
    expect(LINEAR_STAGES.map((s, i) => (s.gate ? i + 1 : null)).filter(Boolean)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("labels the retired stage for old history, but doesn't offer it", () => {
    expect(stageLabel("ADD_TO_PIPELINE")).toBe("Add to pipeline (retired)");
    expect(ALL_STAGES.some((s) => s.key === "ADD_TO_PIPELINE")).toBe(false);
    expect(stageLabel("CAPITAL_TRANSFER")).toBe("Capital Transfer (retired)");
    expect(ALL_STAGES.some((s) => s.key === "CAPITAL_TRANSFER")).toBe(false);
    expect(stageLabel("PASSED")).toBe("Declined");
  });

  it("counts deals as active until Investment Complete", () => {
    expect(isActiveStage("SUBMITTED")).toBe(true);
    expect(isActiveStage("DUE_DILIGENCE")).toBe(true);
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
  const none: { ticketGbp: number; paidAt: Date | null }[] = [];
  it("counts live, in-DD and invested deals, and sums paid final investment tickets", () => {
    const m = dashboardMetrics([
      { currentStage: "SUBMITTED", investedAmountGbp: null, finalInvestments: none },
      { currentStage: "DUE_DILIGENCE", investedAmountGbp: null, finalInvestments: [{ ticketGbp: 9_000, paidAt: d("2026-03-01") }] },
      {
        currentStage: "INVESTMENT_COMPLETE",
        investedAmountGbp: 999_999, // legacy amount ignored once there are final investment entries
        finalInvestments: [
          { ticketGbp: 20_000, paidAt: d("2026-03-01") },
          { ticketGbp: 5_000, paidAt: null }, // not paid yet: doesn't count
        ],
      },
      { currentStage: "SEIS_CERTIFICATE", investedAmountGbp: 75_000, finalInvestments: none }, // legacy deal
      { currentStage: "INVESTMENT_COMPLETE", investedAmountGbp: null, finalInvestments: none },
      { currentStage: "PASSED", investedAmountGbp: null, finalInvestments: none },
    ]);
    expect(m).toEqual({ liveDeals: 2, inDueDiligence: 1, investments: 3, investedTotalGbp: 95_000 });
  });

  it("ignores amounts on deals that aren't invested", () => {
    expect(dashboardMetrics([{ currentStage: "PASSED", investedAmountGbp: 10_000, finalInvestments: none }]).investedTotalGbp).toBe(0);
  });
});

describe("finalInvestmentTotals", () => {
  it("separates committed from paid", () => {
    expect(
      finalInvestmentTotals([
        { ticketGbp: 10_000, paidAt: d("2026-03-01") },
        { ticketGbp: 5_000, paidAt: null },
      ]),
    ).toEqual({ committedGbp: 15_000, paidGbp: 10_000, angels: 2, paidCount: 1 });
  });
});

describe("declining and the board", () => {
  it("allows declining at any live stage", () => {
    expect(canDecline("SUBMITTED")).toBe(true);
    expect(canDecline("DUE_DILIGENCE")).toBe(true);
    expect(canDecline("INVESTMENT_COMPLETE")).toBe(false);
    expect(canDecline("PASSED")).toBe(false);
  });

  it("shows S/EIS Certificate deals under Investment Complete", () => {
    expect(BOARD_STAGES.some((s) => s.key === "SEIS_CERTIFICATE")).toBe(false);
    expect(boardColumn("SEIS_CERTIFICATE")).toBe("INVESTMENT_COMPLETE");
    expect(boardColumn("DUE_DILIGENCE")).toBe("DUE_DILIGENCE");
  });
});

describe("board presentation", () => {
  it("groups stages into phases", () => {
    expect(stagePhase("SUBMITTED")).toBe("intake");
    expect(stagePhase("ELIGIBILITY_SCREEN")).toBe("intake");
    expect(stagePhase("PARTNER_REVIEW")).toBe("review");
    expect(stagePhase("PITCH_OUTCOME")).toBe("review");
    expect(stagePhase("INVESTMENT_COMMITMENTS")).toBe("closing");
    expect(stagePhase("DUE_DILIGENCE")).toBe("closing");
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

describe("advanceTarget", () => {
  it("moves to the next stage, except where a decision form or nowhere applies", () => {
    expect(advanceTarget("SUBMITTED")).toBe("ELIGIBILITY_SCREEN");
    expect(advanceTarget("ELIGIBILITY_SCREEN")).toBeNull(); // eligibility decision form instead
    expect(advanceTarget("PARTNER_REVIEW")).toBe("PITCH_SELECTION");
    expect(advanceTarget("DUE_DILIGENCE")).toBe("INVESTMENT_COMPLETE");
    expect(advanceTarget("INVESTMENT_COMPLETE")).toBe("SEIS_CERTIFICATE");
    expect(advanceTarget("SEIS_CERTIFICATE")).toBeNull();
    expect(advanceTarget("PASSED")).toBeNull();
    expect(advanceTarget("ADD_TO_PIPELINE")).toBe("PARTNER_REVIEW");
  });
});

describe("focusSections", () => {
  it("follows the dealflow, and always keeps documents open", () => {
    expect(focusSections("ELIGIBILITY_SCREEN")).toContain("eligibility");
    expect(focusSections("PARTNER_REVIEW")).toEqual(["assessment", "documents"]);
    expect(focusSections("DUE_DILIGENCE")).toContain("final");
    expect(focusSections("INVESTMENT_COMPLETE")[0]).toBe("final");
    expect(focusSections("PITCH_SELECTION")).toContain("preSelection");
    expect(focusSections("INVESTMENT_COMMITMENTS")).toContain("commitments");
    expect(focusSections("DUE_DILIGENCE")[0]).toBe("dd");
    for (const s of ALL_STAGES) expect(focusSections(s.key)).toContain("documents");
  });
});

describe("declined board filter", () => {
  it("reads the toggle and builds combined URLs", () => {
    expect(parseDeclinedFilter("1")).toBe(true);
    expect(parseDeclinedFilter(undefined)).toBe(false);
    expect(parseDeclinedFilter("yes")).toBe(false);
    expect(boardHref({ kind: "all" }, false)).toBe("/deals");
    expect(boardHref({ kind: "all" }, true)).toBe("/deals?declined=1");
    expect(boardHref({ kind: "round", round: 3 }, true)).toBe("/deals?round=3&declined=1");
    expect(boardHref({ kind: "none" }, false)).toBe("/deals?round=none");
  });

  it("groups declined deals by the stage they were declined at", () => {
    expect(declinedColumn("PITCH_OUTCOME")).toBe("PITCH_OUTCOME");
    expect(declinedColumn("SEIS_CERTIFICATE")).toBe("INVESTMENT_COMPLETE");
    expect(declinedColumn("CAPITAL_TRANSFER")).toBeNull(); // retired stage
    expect(declinedColumn(null)).toBeNull();
  });
});

describe("splitLatestComm", () => {
  it("shows the newest comm and counts hidden ones still to send", () => {
    const r = splitLatestComm([
      { id: "a", createdAt: d("2026-09-01"), status: "NOT_YET_SENT", gate: "ELIGIBILITY" as const },
      { id: "c", createdAt: d("2026-09-03"), status: "SENT", gate: "PITCH_OUTCOME" as const },
      { id: "b", createdAt: d("2026-09-02"), status: "FOUNDER_ACKNOWLEDGED", gate: "PARTNER_REVIEW" as const },
    ]);
    expect(r.latest?.id).toBe("c");
    expect(r.earlier.map((c) => c.id)).toEqual(["b", "a"]);
    expect(r.earlierPending).toBe(1);
    expect(splitLatestComm([]).latest).toBeNull();
  });

  it("breaks ties (one move, several gates) by dealflow order", () => {
    const t = d("2026-09-05");
    const r = splitLatestComm([
      { id: "elig", createdAt: t, status: "NOT_YET_SENT", gate: "ELIGIBILITY" as const },
      { id: "pitch", createdAt: t, status: "NOT_YET_SENT", gate: "PITCH_SELECTION" as const },
      { id: "partner", createdAt: t, status: "NOT_YET_SENT", gate: "PARTNER_REVIEW" as const },
    ]);
    expect([r.latest?.id, ...r.earlier.map((c) => c.id)]).toEqual(["pitch", "partner", "elig"]);
  });
});

describe("eligibilityDisagrees", () => {
  it("spots when the team decided differently from the AI", () => {
    expect(eligibilityDisagrees("Decline", "PROCEED")).toBe(true);
    expect(eligibilityDisagrees("Proceed to pipeline", "PROCEED")).toBe(false);
    expect(eligibilityDisagrees("Need more information", "DECLINE")).toBe(true);
    expect(eligibilityDisagrees(null, "DECLINE")).toBe(false);
  });
});

describe("normaliseCompanyStage", () => {
  it("maps free text onto the stage options, keeping anything else", () => {
    expect(normaliseCompanyStage("Pre-seed")).toBe("Pre-Seed");
    expect(normaliseCompanyStage("pre seed")).toBe("Pre-Seed");
    expect(normaliseCompanyStage("SEED")).toBe("Seed");
    expect(normaliseCompanyStage("series-a")).toBe("Series A");
    expect(normaliseCompanyStage("Bridge")).toBe("Bridge Round");
    expect(normaliseCompanyStage("Series B")).toBe("Series B");
    expect(normaliseCompanyStage("  ")).toBeNull();
  });
});

describe("deckCardState", () => {
  it("shows the board-intake read, then Not screened until a screen exists", () => {
    expect(deckCardState("SUBMITTED", undefined, false)).toBeNull();
    expect(deckCardState("SUBMITTED", { status: "PROCESSING", intakeOnly: true }, false)).toBe("reading");
    expect(deckCardState("SUBMITTED", { status: "COMPLETE", intakeOnly: true }, false)).toBe("not-screened");
    expect(deckCardState("SUBMITTED", { status: "FAILED", intakeOnly: true }, false)).toBe("not-screened");
    expect(deckCardState("SUBMITTED", { status: "PROCESSING", intakeOnly: false }, false)).toBeNull();
    expect(deckCardState("SUBMITTED", { status: "COMPLETE", intakeOnly: false }, true)).toBeNull();
    expect(deckCardState("ELIGIBILITY_SCREEN", { status: "COMPLETE", intakeOnly: true }, false)).toBeNull();
  });
});

describe("dealsByStage", () => {
  it("counts S/EIS Certificate deals as Investment Complete and has no S/EIS row", () => {
    const rows = dealsByStage(["SUBMITTED", "INVESTMENT_COMPLETE", "SEIS_CERTIFICATE", "PASSED"]);
    const count = (k: string) => rows.find((r) => r.key === k)?.count;
    expect(rows.some((r) => r.key === "SEIS_CERTIFICATE")).toBe(false);
    expect(count("INVESTMENT_COMPLETE")).toBe(2);
    expect(count("SUBMITTED")).toBe(1);
    expect(rows.at(-1)).toMatchObject({ key: "PASSED", label: "Declined", count: 1 });
  });
});

describe("angel certification", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  it("expires 12 months after signing (36 for an FCA-firm certificate), clamping month ends", () => {
    expect(certificationExpiry("HIGH_NET_WORTH", d("2026-03-15")).toISOString().slice(0, 10)).toBe("2027-03-15");
    expect(certificationExpiry("SELF_CERTIFIED_SOPHISTICATED", d("2028-02-29")).toISOString().slice(0, 10)).toBe("2029-02-28");
    expect(certificationExpiry("CERTIFIED_SOPHISTICATED", d("2026-01-31")).toISOString().slice(0, 10)).toBe("2029-01-31");
  });
  it("uses the most recently signed statement, and flags due soon (30 days) and overdue", () => {
    const now = d("2026-10-01");
    const old = { signedOn: d("2025-01-01"), expiresOn: d("2026-01-01") };
    const fresh = { signedOn: d("2025-10-20"), expiresOn: d("2026-10-20") };
    expect(latestCertification([fresh, old])).toBe(fresh);
    expect(certState(null, now)).toBe("none");
    expect(certState(old, now)).toBe("overdue");
    expect(certState(fresh, now)).toBe("due-soon");
    expect(certState({ signedOn: now, expiresOn: d("2027-10-01") }, now)).toBe("current");
  });
  it("counts members without a current statement as needing action", () => {
    expect(certNeedsAction("MEMBER", "overdue")).toBe(true);
    expect(certNeedsAction("MEMBER", "none")).toBe(true);
    expect(certNeedsAction("MEMBER", "due-soon")).toBe(false);
    expect(certNeedsAction("PROSPECT", "none")).toBe(false);
    expect(matchesAngelFilter("action", "MEMBER", "none")).toBe(true);
    expect(matchesAngelFilter("due-soon", "MEMBER", "due-soon")).toBe(true);
  });
  it("gates live deals: only current, non-archived members", () => {
    const now = d("2026-10-01");
    const current = { signedOn: d("2026-06-01"), expiresOn: d("2027-06-01") };
    expect(canSeeLiveDeals({ status: "MEMBER", archivedAt: null }, current, now)).toBe(true);
    expect(canSeeLiveDeals({ status: "MEMBER", archivedAt: null }, { signedOn: d("2025-01-01"), expiresOn: d("2026-01-01") }, now)).toBe(false);
    expect(canSeeLiveDeals({ status: "MEMBER", archivedAt: null }, null, now)).toBe(false);
    expect(canSeeLiveDeals({ status: "PROSPECT", archivedAt: null }, current, now)).toBe(false);
    expect(canSeeLiveDeals({ status: "MEMBER", archivedAt: now }, current, now)).toBe(false);
  });
});

describe("angel names and lists", () => {
  const angels = [
    { id: "k", name: "Kevin Walker" },
    { id: "a", name: "Anna Clarke" },
    { id: "a2", name: "Anna Smith" },
  ];
  it("suggests a match only when it's unambiguous", () => {
    expect(suggestAngelMatch("kevin walker", angels)).toBe("k");
    expect(suggestAngelMatch("Kevin W", angels)).toBe("k");
    expect(suggestAngelMatch("Kevin W.", angels)).toBe("k");
    expect(suggestAngelMatch("Kevin", angels)).toBe("k");
    expect(suggestAngelMatch("Anna C", angels)).toBe("a");
    expect(suggestAngelMatch("Anna", angels)).toBeNull(); // two Annas
    expect(suggestAngelMatch("Grace Hopper", angels)).toBeNull();
  });
  it("resolves a vote to an angel by pick, else a confirmed alias", () => {
    const aliases = new Map([["kevin w", "k"]]);
    expect(resolveAngelId({ angelId: "a", angelName: "Kevin W" }, aliases)).toBe("a");
    expect(resolveAngelId({ angelId: null, angelName: " Kevin  W " }, aliases)).toBe("k");
    expect(resolveAngelId({ angelId: null, angelName: "Someone" }, aliases)).toBeNull();
  });
  it("finds duplicates by email or name", () => {
    const groups = findDuplicateAngels([
      { id: "1", name: "Ada Lovelace", email: "ada@x.com" },
      { id: "2", name: "A. Lovelace", email: "ADA@x.com " },
      { id: "3", name: "Grace Hopper", email: null },
      { id: "4", name: "grace  hopper", email: "g@x.com" },
      { id: "5", name: "Alan Turing", email: null },
    ]);
    expect(groups.map((g) => g.map((a) => a.id).sort())).toEqual([["1", "2"], ["3", "4"]]);
  });
  it("parses comma lists", () => {
    expect(parseList(" Fintech, health ;Fintech,, Climate tech ")).toEqual(["Fintech", "health", "Climate tech"]);
    expect(parseList(null)).toEqual([]);
  });
  it("totals an angel's latest EOI per deal and paid tickets", () => {
    const t = (s: string) => new Date(s);
    expect(
      angelTotals(
        [
          { ventureId: "v1", interested: true, maxTicketGbp: 5000, createdAt: t("2026-01-01") },
          { ventureId: "v1", interested: true, maxTicketGbp: 8000, createdAt: t("2026-02-01") },
          { ventureId: "v2", interested: false, maxTicketGbp: 0, createdAt: t("2026-01-01") },
        ],
        [
          { ticketGbp: 7000, paidAt: t("2026-03-01") },
          { ticketGbp: 3000, paidAt: null },
        ],
      ),
    ).toEqual({ committedGbp: 8000, investedGbp: 7000, deals: 1 });
  });
});

describe("angel onboarding", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  const now = d("2026-10-04");
  const blank = { profileConfirmedAt: null, restrictedDeclaredAt: null, onboardedAt: null };
  const current = { signedOn: d("2026-10-04"), expiresOn: d("2027-10-04") };
  it("goes profile, then certify, then welcome, then done", () => {
    expect(nextOnboardingStep(blank, null, now)).toBe("profile");
    expect(nextOnboardingStep({ ...blank, profileConfirmedAt: now }, null, now)).toBe("certify");
    expect(nextOnboardingStep({ ...blank, profileConfirmedAt: now }, { signedOn: d("2025-01-01"), expiresOn: d("2026-01-01") }, now)).toBe("certify");
    expect(nextOnboardingStep({ ...blank, profileConfirmedAt: now }, current, now)).toBe("welcome");
    expect(nextOnboardingStep({ ...blank, profileConfirmedAt: now, restrictedDeclaredAt: now }, null, now)).toBe("welcome");
    expect(nextOnboardingStep({ profileConfirmedAt: now, restrictedDeclaredAt: null, onboardedAt: now }, current, now)).toBe("done");
  });
  it("reports portal access for the admin view", () => {
    const invite = (o: object = {}) => ({ expiresAt: d("2026-10-10"), usedAt: null, revokedAt: null, kind: "INVITE" as const, ...o });
    expect(portalState({ onboardedAt: null }, null, null, now)).toBe("not-invited");
    expect(portalState({ onboardedAt: null }, null, invite(), now)).toBe("invited");
    expect(portalState({ onboardedAt: null }, null, invite({ expiresAt: d("2026-10-01") }), now)).toBe("invite-expired");
    expect(portalState({ onboardedAt: null }, null, invite({ revokedAt: now }), now)).toBe("not-invited");
    expect(portalState({ onboardedAt: null }, { disabledAt: null }, invite({ usedAt: now }), now)).toBe("onboarding");
    expect(portalState({ onboardedAt: now }, { disabledAt: null }, null, now)).toBe("active");
    expect(portalState({ onboardedAt: now }, { disabledAt: now }, null, now)).toBe("revoked");
  });
});

describe("deal room", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("maps stages to phases: nothing before pitch selection or once declined", () => {
    expect(angelDealPhase("SUBMITTED")).toBeNull();
    expect(angelDealPhase("PARTNER_REVIEW")).toBeNull();
    expect(angelDealPhase("PITCH_SELECTION")).toBe("pitch-selection");
    expect(angelDealPhase("PITCH_OUTCOME")).toBe("post-pitch");
    expect(angelDealPhase("INVESTMENT_COMMITMENTS")).toBe("commitments");
    expect(angelDealPhase("DUE_DILIGENCE")).toBe("commitments");
    expect(angelDealPhase("PASSED")).toBeNull();
  });
  it("shows a deal only when shared and at a visible stage", () => {
    expect(angelDealVisibility({ sharedWithAngelsAt: null, currentStage: "PITCH_OUTCOME" })).toBeNull();
    expect(angelDealVisibility({ sharedWithAngelsAt: now, currentStage: "PARTNER_REVIEW" })).toBeNull();
    expect(angelDealVisibility({ sharedWithAngelsAt: now, currentStage: "PASSED" })).toBeNull();
    expect(angelDealVisibility({ sharedWithAngelsAt: now, currentStage: "PITCH_SELECTION" })).toBe("pitch-selection");
  });
  it("unlocks the memo after the pitch and documents by their chosen phase", () => {
    expect(angelSeesMemo("pitch-selection")).toBe(false);
    expect(angelSeesMemo("post-pitch")).toBe(true);
    const doc = (angelVisibleFrom: "POST_PITCH" | "COMMITMENTS" | "DUE_DILIGENCE" | null, o: object = {}) => ({ angelVisibleFrom, archivedAt: null, uploadedAt: now, ...o });
    expect(angelSeesDocument("commitments", doc(null))).toBe(false);
    expect(angelSeesDocument("pitch-selection", doc("POST_PITCH"))).toBe(false);
    expect(angelSeesDocument("post-pitch", doc("POST_PITCH"))).toBe(true);
    expect(angelSeesDocument("post-pitch", doc("COMMITMENTS"))).toBe(false);
    expect(angelSeesDocument("commitments", doc("COMMITMENTS"))).toBe(true);
    expect(angelSeesDocument("commitments", doc("POST_PITCH", { archivedAt: now }))).toBe(false);
    expect(angelSeesDocument("commitments", doc("POST_PITCH", { uploadedAt: null }))).toBe(false);
    // Due-diligence documents: DD started AND the angel committed.
    expect(angelSeesDocument("commitments", doc("DUE_DILIGENCE"))).toBe(false);
    expect(angelSeesDocument("commitments", doc("DUE_DILIGENCE"), { open: true, committed: false })).toBe(false);
    expect(angelSeesDocument("commitments", doc("DUE_DILIGENCE"), { open: false, committed: true })).toBe(false);
    expect(angelSeesDocument("commitments", doc("DUE_DILIGENCE"), { open: true, committed: true })).toBe(true);
    expect(angelSeesDocument("commitments", doc("DUE_DILIGENCE", { archivedAt: now }), { open: true, committed: true })).toBe(false);
  });
  it("opens pre-selection voting, then EOIs until DD", () => {
    expect(angelVoteKind("PITCH_SELECTION")).toBe("pre-selection");
    expect(angelVoteKind("PITCH_OUTCOME")).toBe("eoi");
    expect(angelVoteKind("INVESTMENT_COMMITMENTS")).toBe("eoi");
    expect(angelVoteKind("DUE_DILIGENCE")).toBeNull();
  });
});

describe("due diligence sharing", () => {
  const t = (d: number) => new Date(Date.UTC(2026, 9, d));
  it("opens DD documents from Due Diligence on", () => {
    expect(angelDdOpen("INVESTMENT_COMMITMENTS")).toBe(false);
    expect(angelDdOpen("DUE_DILIGENCE")).toBe(true);
    expect(angelDdOpen("INVESTMENT_COMPLETE")).toBe(true);
    expect(angelDdOpen("PASSED")).toBe(false);
  });
  it("counts an angel as committed from their latest EOI, or a final ticket", () => {
    const aliases = new Map([["kevin w", "kevin"]]);
    const ids = committedAngelIds(
      [
        { angelId: "anna", angelName: "Anna", interested: true, createdAt: t(1) },
        { angelId: "anna", angelName: "Anna", interested: false, createdAt: t(2) }, // changed her mind
        { angelId: null, angelName: "Kevin W", interested: true, createdAt: t(1) }, // linked by alias
        { angelId: null, angelName: "Someone Unlinked", interested: true, createdAt: t(1) },
        { angelId: "bo", angelName: "Bo", interested: false, createdAt: t(1) },
      ],
      [{ angelId: "bo", angelName: "Bo" }],
      aliases,
    );
    expect([...ids].sort()).toEqual(["bo", "kevin"]);
  });
});

describe("team access", () => {
  it("never lets the team lock itself out", () => {
    expect(teamRevokeBlock("me", "me", 3)).toMatch(/own/);
    expect(teamRevokeBlock("me", "anna", 1)).toMatch(/last/);
    expect(teamRevokeBlock("me", "anna", 2)).toBeNull();
  });
});

describe("members' round board", () => {
  const shared = new Date();
  const deal = (round: number | null, currentStage: Parameters<typeof memberBoardCards>[0][number]["currentStage"], sharedWithAngelsAt: Date | null = shared) => ({
    round,
    currentStage,
    sharedWithAngelsAt,
  });
  it("shows the offered round's live deals only, opening from Member Pitch Selection for shared deals", () => {
    const cards = memberBoardCards(
      [
        deal(4, "SUBMITTED"),
        deal(4, "PARTNER_REVIEW"),
        deal(4, "PITCH_SELECTION"),
        deal(4, "PITCH_OUTCOME", null), // not shared: card only
        deal(4, "PASSED"), // declined: never shown
        deal(4, "SEIS_CERTIFICATE"),
        deal(3, "PITCH_SELECTION"), // other round
      ],
      4,
    );
    expect(cards.map((c) => [c.currentStage, c.column, c.phase])).toEqual([
      ["SUBMITTED", "SUBMITTED", null],
      ["PARTNER_REVIEW", "PARTNER_REVIEW", null],
      ["PITCH_SELECTION", "PITCH_SELECTION", "pitch-selection"],
      ["PITCH_OUTCOME", "PITCH_OUTCOME", null],
      ["SEIS_CERTIFICATE", "INVESTMENT_COMPLETE", "commitments"],
    ]);
    expect(memberBoardCards([deal(4, "PITCH_SELECTION")], null)).toEqual([]);
  });
});

describe("my portfolio", () => {
  const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
  const h = (o: Partial<Parameters<typeof portfolioSummary>[0][number]>) => ({
    company: "Co",
    source: "OUTSIDE" as const,
    currency: "GBP",
    amountMinor: 100_000,
    currentValueMinor: null,
    proceedsMinor: null,
    status: "ACTIVE" as const,
    taxScheme: null,
    sector: null,
    investedOn: null,
    keyDate: null,
    keyDateNote: null,
    ...o,
  });

  it("reads money as people type it", () => {
    expect(parseMoneyMinor("£991.83")).toBe(99_183);
    expect(parseMoneyMinor("1,000")).toBe(100_000);
    expect(parseMoneyMinor("1.5k")).toBe(150_000);
    expect(parseMoneyMinor("")).toBeNull();
    expect(parseMoneyMinor("about a grand")).toBeNaN();
    expect(formatMoneyMinor(99_183)).toBe("£991.83");
    expect(formatMoneyMinor(100_000, "USD")).toBe("US$1,000");
  });

  it("values holdings at cost until revalued; exits count their proceeds; write-offs are zero", () => {
    expect(holdingMultiple(h({}))).toBe(1);
    expect(holdingMultiple(h({ currentValueMinor: 250_000 }))).toBe(2.5);
    expect(holdingMultiple(h({ status: "EXITED", proceedsMinor: 300_000 }))).toBe(3);
    expect(holdingMultiple(h({ status: "WRITTEN_OFF" }))).toBe(0);
    expect(holdingMultiple(h({ amountMinor: null }))).toBeNull();
  });

  it("totals per currency, estimates S/EIS relief in GBP, and leaves pending tickets out", () => {
    const s = portfolioSummary([
      h({ source: "DXV", taxScheme: "SEIS", sector: "Health", investedOn: d(2025, 6, 1) }),
      h({ taxScheme: "EIS", currentValueMinor: 200_000, sector: "Health", investedOn: d(2026, 1, 1) }),
      h({ status: "WRITTEN_OFF", sector: "Climate", investedOn: d(2026, 2, 1) }),
      h({ currency: "USD", amountMinor: 50_000 }),
      h({ source: "DXV", pending: true }),
    ]);
    expect(s.byCurrency.map((c) => [c.currency, c.investedMinor, c.valueMinor])).toEqual([
      ["GBP", 300_000, 300_000],
      ["USD", 50_000, 50_000],
    ]);
    expect(s.byCurrency[0].multiple).toBe(1);
    expect([s.companies, s.active, s.writtenOff, s.viaDxv, s.outside, s.pending.length]).toEqual([4, 3, 1, 1, 3, 1]);
    expect(s.reliefMinor).toBe(50_000 + 30_000);
    expect(s.bySector.map((x) => [x.label, x.investedMinor])).toEqual([
      ["Health", 200_000],
      ["Climate", 100_000],
    ]);
    expect(s.byYear.map((x) => x.label)).toEqual(["2025", "2026"]);
  });

  it("diarises S/EIS holding periods and key dates, soonest first", () => {
    expect(reliefHoldingEnds(d(2025, 6, 20))).toEqual(d(2028, 6, 20));
    const dates = portfolioDates(
      [
        h({ company: "A", taxScheme: "EIS", investedOn: d(2025, 6, 20) }),
        h({ company: "B", keyDate: d(2027, 1, 1), keyDateNote: "ASA longstop" }),
        h({ company: "C", taxScheme: "SEIS", investedOn: d(2020, 1, 1) }), // already passed
        h({ company: "D", status: "WRITTEN_OFF", taxScheme: "SEIS", investedOn: d(2025, 1, 1), keyDate: d(2027, 2, 1), keyDateNote: "Loss relief claim" }),
      ],
      d(2026, 9, 30),
    );
    // D is written off: no holding period to keep, but its own key date still counts.
    expect(dates.map((x) => [x.company, x.what])).toEqual([
      ["B", "ASA longstop"],
      ["D", "Loss relief claim"],
      ["A", "EIS 3-year holding period ends"],
    ]);
  });
});
