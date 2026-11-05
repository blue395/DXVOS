import { describe, expect, it } from "vitest";
import { founderEmailProblems } from "./member-email";
import { founderAudience, founderAudienceLabel, founderEmailAddress, pitchSessionText } from "./pipeline";
import type { Stage } from "@/generated/prisma/enums";

const deal = (id: string, currentStage: Stage, round: number | null, founderEmail: string | null) => ({ id, currentStage, round, founderEmail });
const deals = [
  deal("a", "PITCH_SELECTION", 3, "ada@acme.com"),
  deal("b", "PITCH_OUTCOME", 3, " bo@beta.io "),
  deal("c", "PITCH_SELECTION", 2, "cy@gamma.co.uk"),
  deal("d", "PASSED", 3, "di@delta.com"),
  deal("e", "PITCH_SELECTION", 3, null),
  deal("f", "SEIS_CERTIFICATE", 3, "fi@zeta.com"),
  deal("g", "CAPITAL_TRANSFER", 3, "g@retired.com"),
  deal("h", "PITCH_SELECTION", 3, "one@x.com, two@x.com"),
];

describe("emails to founders: who they go to", () => {
  it("takes one round and the chosen stages, never declined deals unless asked", () => {
    const r = founderAudience(deals, { round: 3, stages: ["PITCH_SELECTION"], includeDeclined: false });
    expect(r.send.map((v) => v.id)).toEqual(["a"]);
    expect(r.noEmail.map((v) => v.id)).toEqual(["e", "h"]);
  });
  it("no stages chosen = every live stage (S/EIS counts as Investment Complete; retired stages left out)", () => {
    const r = founderAudience(deals, { round: 3, stages: [], includeDeclined: false });
    expect(r.send.map((v) => v.id)).toEqual(["a", "b", "f"]);
    expect(founderAudience(deals, { round: 3, stages: ["INVESTMENT_COMPLETE"], includeDeclined: false }).send.map((v) => v.id)).toEqual(["f"]);
  });
  it("includes declined deals only when ticked, and any round when none is chosen", () => {
    expect(founderAudience(deals, { round: 3, stages: ["PITCH_SELECTION"], includeDeclined: true }).send.map((v) => v.id)).toEqual(["a", "d"]);
    expect(founderAudience(deals, { round: null, stages: ["PITCH_SELECTION"], includeDeclined: false }).send.map((v) => v.id)).toEqual(["a", "c"]);
  });
  it("sends to the trimmed address, and only to one address", () => {
    expect(founderAudience(deals, { round: 3, stages: ["PITCH_OUTCOME"], includeDeclined: false }).send[0].email).toBe("bo@beta.io");
    expect(founderEmailAddress("one@x.com, two@x.com")).toBeNull();
    expect(founderEmailAddress("Ada <ada@acme.com>")).toBeNull();
    expect(founderEmailAddress("not-an-email")).toBeNull();
    expect(founderEmailAddress("ada@acme.com")).toBe("ada@acme.com");
  });
  it("describes the choice in words", () => {
    expect(founderAudienceLabel({ round: 3, stages: ["PITCH_SELECTION", "PITCH_OUTCOME"], includeDeclined: false })).toBe(
      "Round 3 · Member Pitch Selection, Pitch Outcome",
    );
    expect(founderAudienceLabel({ round: null, stages: [], includeDeclined: true })).toBe("All rounds · every live stage · declined deals included");
  });
});

describe("emails to founders: wording", () => {
  it("allows only {{first_name}} and {{company}}", () => {
    expect(founderEmailProblems({ subject: "{{company}} pitch", body: "Hi {{first_name}}" })).toEqual([]);
    expect(founderEmailProblems({ subject: "s", body: "Link: {{platform_link}} {{next_step}} {{firstname}}" })).toEqual([
      "{{platform_link}} can't be used in emails to founders (use {{first_name}} or {{company}}).",
      "{{next_step}} can't be used in emails to founders (use {{first_name}} or {{company}}).",
      "{{firstname}} can't be used in emails to founders (use {{first_name}} or {{company}}).",
    ]);
  });
  it("blocks sending until the session details are filled in", () => {
    expect(founderEmailProblems({ subject: "s", body: "When: PASTE-SESSION-DETAILS" })).toEqual(["Replace PASTE-SESSION-DETAILS with the real details."]);
  });
  it("writes the pitch session in UK time, with the Luma link only if it's Luma's", () => {
    const e = { title: "DXV pitch session", startsAt: new Date("2026-11-26T18:30:00Z"), location: "Runway East, Bristol", lumaUrl: "https://lu.ma/dxv-nov" };
    expect(pitchSessionText(e)).toBe(
      "DXV pitch session: Thursday 26 November 2026 at 18:30 (UK time)\nWhere: Runway East, Bristol\nDetails: https://lu.ma/dxv-nov",
    );
    expect(pitchSessionText({ ...e, startsAt: new Date("2026-07-02T17:00:00Z"), lumaUrl: "https://evil.example" })).toBe(
      "DXV pitch session: Thursday 2 July 2026 at 18:00 (UK time)\nWhere: Runway East, Bristol",
    );
  });
});
