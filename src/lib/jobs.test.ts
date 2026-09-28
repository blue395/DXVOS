import { describe, expect, it } from "vitest";
import { estimatedProgress, formatElapsed, isRunning } from "./jobs";

describe("estimatedProgress", () => {
  it("starts low, rises, and never claims to be done", () => {
    expect(estimatedProgress(0, 120)).toBe(2);
    const early = estimatedProgress(30_000, 120);
    const usual = estimatedProgress(120_000, 120);
    expect(early).toBeGreaterThan(20);
    expect(usual).toBeGreaterThan(early);
    expect(usual).toBeGreaterThan(70);
    expect(estimatedProgress(60 * 60_000, 120)).toBe(95);
  });
});

describe("formatElapsed", () => {
  it("shows minutes and seconds", () => {
    expect(formatElapsed(7_400)).toBe("0:07");
    expect(formatElapsed(135_000)).toBe("2:15");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("isRunning", () => {
  it("treats pending and processing as running", () => {
    expect(isRunning({ status: "PENDING" })).toBe(true);
    expect(isRunning({ status: "PROCESSING" })).toBe(true);
    expect(isRunning({ status: "COMPLETE" })).toBe(false);
    expect(isRunning({ status: "FAILED" })).toBe(false);
  });
});
