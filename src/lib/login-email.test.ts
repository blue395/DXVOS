import { describe, expect, it } from "vitest";
import { loginLinkEmail } from "./login-email";

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
