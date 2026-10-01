import { describe, expect, it } from "vitest";
import { loginLinkEmail, sentLinkEmail } from "./login-email";

describe("loginLinkEmail", () => {
  it("says what the link does, how long it lasts, and escapes names", () => {
    const m = loginLinkEmail("MAGIC", { name: "Ada <b>Lovelace</b>", link: "https://os.example/login/link/abc", minutes: 15 });
    expect(m.subject).toBe("Your DXV sign-in link");
    expect(m.text).toContain("https://os.example/login/link/abc");
    expect(m.text).toContain("15 minutes");
    expect(m.html).toContain("Hello Ada,");
    const r = loginLinkEmail("RESET", { name: "<script>", link: "https://os.example/x", minutes: 30 });
    expect(r.subject).toBe("Reset your DXV password");
    expect(r.html).not.toContain("<script>");
  });
});

describe("sentLinkEmail", () => {
  it("names who sent it and when the link stops working", () => {
    const m = sentLinkEmail("MEMBER_INVITE", { name: "Grace Hopper", link: "https://os.example/join/abc", expiresAt: new Date("2026-10-15T12:00:00Z"), sentBy: "Blue O'Connor" });
    expect(m.subject).toBe("Your invitation to the DXV members' portal");
    expect(m.text).toContain("Blue has invited you");
    expect(m.text).toContain("until 15 October");
    expect(m.html).toContain("Blue has invited you"); // no apostrophe in the name here
    expect(sentLinkEmail("RESET", { name: "A", link: "x", expiresAt: new Date(), sentBy: "Anna C" }).subject).toBe("Set a new DXV password");
    expect(sentLinkEmail("TEAM_INVITE", { name: "A", link: "x", expiresAt: new Date(), sentBy: "Kevin" }).text).toContain("Kevin has invited you to DXV OS");
  });
});
