import { describe, expect, it } from "vitest";
import { SubmissionSchema, formTimingOk, founderFirstName, founderTemplateKey, matchExistingVenture, submissionLimitError } from "./founder-intake";

const valid = {
  companyName: "Acme Health",
  founderNames: "Jane Doe & John Smith",
  email: "Jane@Acme.com ",
  pitch: "Repeat prescriptions for independent pharmacies",
  sector: "Healthtech",
  companyStage: "Pre-seed",
  raiseAmountGbp: "250000",
  website: "https://acme.example",
  linkedinUrl: "",
  heardFrom: "",
  diversityThemes: ["Female Founder", "Prefer not to say"],
  privacyConsent: true,
  diversityConsent: true,
  fileName: "Acme deck.pdf",
  fileSize: 1000,
};

describe("founder submission form", () => {
  it("accepts a good submission and tidies it", () => {
    const r = SubmissionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ email: "jane@acme.com", raiseAmountGbp: 250000, linkedinUrl: null, diversityThemes: ["Female Founder"] });
  });
  it("only keeps diversity answers with consent", () => {
    expect(SubmissionSchema.parse({ ...valid, diversityConsent: false }).diversityThemes).toEqual([]);
  });
  it("needs privacy consent, a PDF and a real website address", () => {
    expect(SubmissionSchema.safeParse({ ...valid, privacyConsent: false }).success).toBe(false);
    expect(SubmissionSchema.safeParse({ ...valid, fileName: "deck.pptx" }).success).toBe(false);
    expect(SubmissionSchema.safeParse({ ...valid, website: "acme" }).success).toBe(false);
  });
});

describe("founder submission rules", () => {
  it("limits spam", () => {
    expect(submissionLimitError({ fromIpLastHour: 0, fromEmailLastDay: 0, totalLastDay: 0 })).toBeNull();
    expect(submissionLimitError({ fromIpLastHour: 5, fromEmailLastDay: 0, totalLastDay: 0 })).toMatch(/try again later/);
    expect(submissionLimitError({ fromIpLastHour: 0, fromEmailLastDay: 3, totalLastDay: 0 })).toMatch(/already received/);
  });
  it("catches instant (bot) and stale submissions", () => {
    expect(formTimingOk(0, 1_000)).toBe(false);
    expect(formTimingOk(0, 60_000)).toBe(true);
    expect(formTimingOk(0, 13 * 3_600_000)).toBe(false);
  });
  it("greets the first founder by first name", () => {
    expect(founderFirstName("Jane Doe & John Smith")).toBe("Jane");
    expect(founderFirstName("Amara Okafor, Priya Shah")).toBe("Amara");
    expect(founderFirstName("")).toBe("there");
  });
  it("adds a resubmitted deck to the live deal, and links back to a declined one", () => {
    const vs = [
      { id: "old", name: "Acme Health Ltd", currentStage: "PASSED" as const, createdAt: new Date("2025-01-01") },
      { id: "other", name: "Other Co", currentStage: "SUBMITTED" as const, createdAt: new Date("2026-01-01") },
    ];
    expect(matchExistingVenture("Acme Health", vs)).toEqual({ mode: "previously-declined", ventureId: "old" });
    expect(matchExistingVenture("other co.", vs)).toEqual({ mode: "resubmission", ventureId: "other" });
    expect(matchExistingVenture("Brand New", vs)).toEqual({ mode: "new" });
  });
  it("answers declines with the decline template", () => {
    expect(founderTemplateKey("PASSED")).toBe("founder-decline");
    expect(founderTemplateKey("PARTNER_REVIEW")).toBe("founder-progress");
  });
});
