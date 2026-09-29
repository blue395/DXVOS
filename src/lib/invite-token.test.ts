import { describe, expect, it } from "vitest";
import { hashInviteToken, isInviteTokenShape, newInviteToken } from "./invite-token";

describe("invite tokens", () => {
  it("are 256-bit, stored only as a hash, and unique", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(isInviteTokenShape(a.token)).toBe(true);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
    expect(a.token).not.toBe(b.token);
    expect(isInviteTokenShape("../etc/passwd")).toBe(false);
  });
});
