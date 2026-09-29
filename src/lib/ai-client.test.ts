import { describe, expect, it } from "vitest";
import { apiErrorMessage, WORKER_MAX_RETRIES, workerAnthropic } from "./ai-client";

describe("apiErrorMessage", () => {
  it("explains overloads and outages as Anthropic being busy", () => {
    expect(apiErrorMessage({ status: 503 })).toMatch(/busy/);
    expect(apiErrorMessage({ status: 529 })).toMatch(/busy/);
    expect(apiErrorMessage({ status: 500, type: "overloaded_error" })).toMatch(/busy/);
  });
  it("names credit, key and rate-limit problems", () => {
    expect(apiErrorMessage({ status: 402, type: "billing_error" })).toMatch(/out of credit/);
    expect(apiErrorMessage({ status: 401 })).toMatch(/API key/);
    expect(apiErrorMessage({ status: 429 })).toMatch(/usage limit/);
    expect(apiErrorMessage({ status: 502 })).toMatch(/error \(502\)/);
    expect(apiErrorMessage({ status: null })).toMatch(/network/);
  });
  it("gives background jobs extra retries", () => {
    process.env.ANTHROPIC_API_KEY ??= "test-key";
    expect(workerAnthropic().maxRetries).toBe(WORKER_MAX_RETRIES);
  });
});
