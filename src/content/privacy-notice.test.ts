import { describe, expect, it } from "vitest";
import { privacyNotice, privacyNoticeGaps } from "./privacy-notice";
import { FOUNDER_DIVERSITY_INTRO, founderDiversityConsent } from "./founder-application";
import { FOUNDER_DIVERSITY_THEMES } from "@/lib/pipeline";

const filled = { legalName: "Example Ventures Ltd", companyNumber: "01234567", registeredAddress: "1 Example Street, Bristol", dataProtectionLead: "A Person" };

describe("privacy notice", () => {
  it("lists what's missing before it can be published (invites wait for it)", () => {
    expect(privacyNoticeGaps({ legalName: null, companyNumber: " ", registeredAddress: "x", dataProtectionLead: null })).toEqual([
      "DXV's legal entity name",
      "company number",
      "the data protection lead's name",
    ]);
    expect(privacyNoticeGaps(filled)).toEqual([]);
    expect(privacyNoticeGaps()).toEqual([]); // DXV's own details are in, so invites aren't held up by the notice
  });
  it("has no square-bracketed placeholders once the facts are filled in", () => {
    const strings: string[] = [];
    JSON.stringify(privacyNotice("privacy@example.test", filled), (_k, v) => (typeof v === "string" && strings.push(v), v));
    for (const t of strings) expect(t).not.toMatch(/\[[^\]]*\]/);
    const text = strings.join(" ");
    expect(text).toContain("Example Ventures Ltd");
  });
  it("names every founder diversity category the platform offers", () => {
    const text = JSON.stringify(privacyNotice("privacy@example.test", filled));
    for (const t of FOUNDER_DIVERSITY_THEMES) expect(text).toContain(t);
  });
  it("keeps 24 months for diversity answers, in the notice and the founder form alike", () => {
    expect(JSON.stringify(privacyNotice("x@example.test", filled))).toContain("24 months after collection");
    expect(FOUNDER_DIVERSITY_INTRO.join(" ")).toContain("24 months after you submit them");
    expect(founderDiversityConsent("x@example.test")).toContain("x@example.test");
  });
});
