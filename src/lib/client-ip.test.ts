import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "./client-ip";

const bag = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });

describe("clientIp", () => {
  it("uses Netlify's own header, which visitors can't fake", () => {
    expect(clientIp(bag({ "x-nf-client-connection-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 203.0.113.9" }), true)).toBe("203.0.113.9");
  });
  it("never trusts a visitor-supplied X-Forwarded-For in production", () => {
    expect(clientIp(bag({ "x-forwarded-for": "1.2.3.4" }), true)).toBeNull();
  });
  it("falls back to X-Forwarded-For in local development", () => {
    expect(clientIp(bag({ "x-forwarded-for": "127.0.0.1, 10.0.0.1" }), false)).toBe("127.0.0.1");
    expect(clientIp(bag({}), false)).toBeNull();
  });
  it("hashes IPs with a key (same IP, same hash; never the address)", () => {
    expect(hashIp("203.0.113.9", "k")).toBe(hashIp("203.0.113.9", "k"));
    expect(hashIp("203.0.113.9", "k")).not.toContain("203");
    expect(hashIp("203.0.113.9", "k")).not.toBe(hashIp("203.0.113.9", "other"));
    expect(hashIp(null, "k")).toBeNull();
  });
});
