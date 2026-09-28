import { describe, expect, it } from "vitest";
import { createWorkerToken, verifyWorkerToken } from "./worker-auth";

const SECRET = "test-secret-that-is-at-least-32-characters";

describe("worker tokens", () => {
  it("round-trips a valid token", () => {
    expect(verifyWorkerToken(createWorkerToken("abc123", SECRET), SECRET)).toBe("abc123");
  });
  it("rejects a tampered id, wrong secret, or expired token", () => {
    const t = createWorkerToken("abc123", SECRET, 1_000);
    expect(verifyWorkerToken(t.replace("abc123", "zzz999"), SECRET, 2_000)).toBeNull();
    expect(verifyWorkerToken(t, "another-secret-another-secret-xx", 2_000)).toBeNull();
    expect(verifyWorkerToken(t, SECRET, 1_000 + 6 * 60 * 1000)).toBeNull();
    expect(verifyWorkerToken("garbage", SECRET)).toBeNull();
  });
});

describe("job-kind prefixes", () => {
  it("keeps the memo prefix in the verified subject", () => {
    expect(verifyWorkerToken(createWorkerToken("memo:abc-123", SECRET), SECRET)).toBe("memo:abc-123");
  });
});
