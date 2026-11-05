import { describe, expect, it } from "vitest";
import { joinAlreadyMemberEmail, joinConfirmEmail, joinRequestPartnerEmail } from "./login-email";
import { JOIN_LIMITS, joinLinkState, joinRequestLimitError } from "./pipeline";

const now = new Date("2026-11-05T12:00:00Z");
const link = (o: Partial<{ revokedAt: Date | null; expiresAt: Date; maxUses: number | null }> = {}) => ({
  revokedAt: null,
  expiresAt: new Date("2026-12-01T00:00:00Z"),
  maxUses: null,
  ...o,
});

describe("shareable sign-up links", () => {
  it("is open until switched off, expired or used up", () => {
    expect(joinLinkState(link(), 50, now)).toBe("open");
    expect(joinLinkState(link({ revokedAt: now }), 0, now)).toBe("switched-off");
    expect(joinLinkState(link({ expiresAt: now }), 0, now)).toBe("expired");
    expect(joinLinkState(link({ maxUses: 3 }), 2, now)).toBe("open");
    expect(joinLinkState(link({ maxUses: 3 }), 3, now)).toBe("full");
  });
  it("limits requests per IP, email and link", () => {
    expect(joinRequestLimitError({ fromIpLastHour: 0, fromEmailLastDay: 0, viaLinkLastDay: 0 })).toBeNull();
    expect(joinRequestLimitError({ fromIpLastHour: JOIN_LIMITS.perIpPerHour, fromEmailLastDay: 0, viaLinkLastDay: 0 })).toMatch(/lot of requests/);
    expect(joinRequestLimitError({ fromIpLastHour: 0, fromEmailLastDay: JOIN_LIMITS.perEmailPerDay, viaLinkLastDay: 0 })).toMatch(/Check your inbox/);
    expect(joinRequestLimitError({ fromIpLastHour: 0, fromEmailLastDay: 0, viaLinkLastDay: JOIN_LIMITS.perLinkPerDay })).toMatch(/lot of requests/);
  });
  it("emails escape what people typed and say what happens next", () => {
    const c = joinConfirmEmail({ name: "<b>Sam</b>", link: "https://dxv.example/join/open/confirm/t", hours: 48 });
    expect(c.html).not.toContain("<b>Sam");
    expect(c.text).toContain("48 hours");
    expect(joinAlreadyMemberEmail({ name: "Sam", signInUrl: "https://dxv.example/login" }).text).toContain("https://dxv.example/login");
    const p = joinRequestPartnerEmail({
      partnerName: "Blue",
      name: "Sam <script>",
      email: "sam@example.test",
      label: "WhatsApp",
      matched: "Sam Synthetic (member)",
      reviewUrl: "https://dxv.example/angels/invite",
    });
    expect(p.html).not.toContain("<script>");
    expect(p.text).toContain("already in the directory as Sam Synthetic (member)");
  });
});

describe("already on DXV with a different login email", () => {
  it("hints at the login address, partly hidden", async () => {
    const { maskEmail } = await import("./pipeline");
    expect(maskEmail("blue@socialventurise.com")).toBe("bl••@socialventurise.com");
    expect(maskEmail("ab@x.io")).toBe("a••@x.io");
    const m = joinAlreadyMemberEmail({ name: "Blue", signInUrl: "https://dxv.example/login", loginEmailHint: maskEmail("blue@socialventurise.com") });
    expect(m.text).toContain("your login uses a different email address: bl••@socialventurise.com");
    expect(m.text).not.toContain("blue@socialventurise.com");
  });
});

describe("instant links are capped and short-lived", () => {
  it("refuses long or uncapped-above-the-limit instant links; approve-first links are free", async () => {
    const { joinLinkSettingsProblem, JOIN_INSTANT_MAX_DAYS, JOIN_INSTANT_MAX_USES } = await import("./pipeline");
    expect(joinLinkSettingsProblem({ instant: true, days: 30, maxUses: 10 })).toBeNull();
    expect(joinLinkSettingsProblem({ instant: true, days: 90, maxUses: 10 })).toMatch(`${JOIN_INSTANT_MAX_DAYS} days`);
    expect(joinLinkSettingsProblem({ instant: true, days: 7, maxUses: 51 })).toMatch(`${JOIN_INSTANT_MAX_USES} sign-ups`);
    expect(joinLinkSettingsProblem({ instant: false, days: 90, maxUses: null })).toBeNull();
  });
  it("tells partners who signed up, escaped", async () => {
    const { joinInstantPartnerEmail } = await import("./login-email");
    const m = joinInstantPartnerEmail({
      partnerName: "Blue",
      name: "<i>Sam</i>",
      email: "sam@example.test",
      label: "WhatsApp",
      matched: null,
      angelUrl: "https://dxv.example/angels/a1",
    });
    expect(m.html).not.toContain("<i>Sam");
    expect(m.text).toContain("signed up through the instant link");
  });
});
