import { describe, expect, it } from "vitest";
import {
  guessDealMapping,
  mapDealRow,
  normaliseCompanyName,
  parseDeclinedStage,
  parsePassReason,
  parsePounds,
  parseRound,
  resolveDecline,
} from "./deal-import";

describe("historical deals import", () => {
  it("guesses columns from typical spreadsheet headers", () => {
    expect(guessDealMapping(["Company", "Founder", "Email", "Sector", "Raising", "Date received", "Date declined", "Stage declined", "Reason", "Notes"])).toEqual([
      "name",
      "founderNames",
      "founderEmail",
      "sector",
      "raise",
      "submittedOn",
      "declinedOn",
      "declinedAt",
      "reason",
      "note",
    ]);
  });

  it("reads amounts, rounds, stages and reasons as people write them", () => {
    expect(parsePounds("£250k")).toBe(250_000);
    expect(parsePounds("1,200,000")).toBe(1_200_000);
    expect(parsePounds("£1.5m")).toBe(1_500_000);
    expect(parsePounds("tbc")).toBeNull();
    expect(parseRound("Round 3")).toBe(3);
    expect(parseDeclinedStage("Pitch selection vote")).toBe("PITCH_SELECTION");
    expect(parseDeclinedStage("Pitched")).toBe("PITCH_OUTCOME");
    expect(parseDeclinedStage("DD")).toBe("DUE_DILIGENCE");
    expect(parseDeclinedStage("Screening")).toBe("ELIGIBILITY_SCREEN");
    expect(parseDeclinedStage("??")).toBeNull();
    expect(parsePassReason("Valuation too high")).toBe("VALUATION_GAP");
    expect(parsePassReason("Not enough angel interest")).toBe("INSUFFICIENT_INTEREST");
    expect(parsePassReason("Not a fit with our thesis")).toBe("INELIGIBLE");
    expect(parsePassReason("Team concerns")).toBeNull();
  });

  it("maps a row and records the decline, keeping unmatched reasons as notes", () => {
    const mapping = guessDealMapping(["Company", "Website", "Date received", "Date declined", "Reason", "Notes"]);
    const row = mapDealRow(["Acme Ltd", "acme.io", "01/03/2025", "15/04/2025", "Team concerns", "Revisit next year"], mapping)!;
    expect(row).toMatchObject({ name: "Acme Ltd", website: "https://acme.io", submittedOn: "2025-03-01", declinedOn: "2025-04-15", reason: null, reasonText: "Team concerns" });
    const d = resolveDecline(row, { stage: "ELIGIBILITY_SCREEN", reason: "INELIGIBLE" });
    expect(d.passReason).toBe("OTHER");
    expect(d.passNote).toBe("Team concerns. Revisit next year");
    expect(d.passedFromStage).toBe("ELIGIBILITY_SCREEN");
    expect(d.createdAt.toISOString().slice(0, 10)).toBe("2025-03-01");
    expect(d.declinedAt.toISOString().slice(0, 10)).toBe("2025-04-15");
    expect(mapDealRow(["", "x.io"], mapping)).toBeNull();
  });

  it("uses the file's defaults when a row says nothing, and never declines before receiving", () => {
    const row = mapDealRow(["Beta", "2025-05-10", "2025-05-01"], ["name", "submittedOn", "declinedOn"])!;
    const d = resolveDecline(row, { stage: "PARTNER_REVIEW", reason: "INSUFFICIENT_INTEREST" });
    expect(d).toMatchObject({ passedFromStage: "PARTNER_REVIEW", passReason: "INSUFFICIENT_INTEREST", passNote: null });
    expect(d.declinedAt).toEqual(d.createdAt);
    const other = resolveDecline(row, { stage: "SUBMITTED", reason: "OTHER" });
    expect(other.passNote).toMatch(/No reason recorded/);
  });

  it("spots the same company written differently", () => {
    expect(normaliseCompanyName("Acme Ltd.")).toBe(normaliseCompanyName("ACME limited"));
    expect(normaliseCompanyName("Fish & Chips Co")).toBe("fish and chips");
  });
});
