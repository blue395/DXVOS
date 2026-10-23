// The small-number rule, with synthetic counts only.
import { describe, expect, it } from "vitest";
import { FEWER, countOf, crossTab, singleCharacteristicReport, type RawCount } from "./report";

const rows = (question: string, respondents: number, counts: Record<string, number>): RawCount[] =>
  Object.entries(counts).map(([value, n]) => ({ question, value, n, respondents }));

describe("small-number rule", () => {
  it("never shows a group of fewer than 10", () => {
    const r = singleCharacteristicReport(rows("gender", 60, { Woman: 30, Man: 22, "Non-binary": 3, "Self-described": 5 }));
    const g = r[0];
    expect(g.respondents).toBe(60);
    expect(g.rows.find((x) => x.value === "Non-binary")?.count).toBe(FEWER);
    expect(g.rows.find((x) => x.value === "Self-described")?.count).toBe(FEWER);
    expect(g.rows.find((x) => x.value === "Woman")?.count).toBe(30);
    expect(g.rows.every((x) => x.count === FEWER || x.count >= 10)).toBe(true);
  });

  it("hides a second group when only one is hidden, so it can't be found by subtraction", () => {
    const g = singleCharacteristicReport(rows("disability", 40, { No: 25, "Yes, neurodivergent": 11, "Yes, disability": 4 }))[0];
    expect(g.rows.filter((x) => x.count === FEWER).map((x) => x.value).sort()).toEqual(["Yes, disability", "Yes, neurodivergent"]);
  });

  it("shows nothing about a question fewer than 10 people answered", () => {
    const g = singleCharacteristicReport(rows("religion", 7, { Christian: 4, None: 3 }))[0];
    expect(g).toEqual({ question: "religion", respondents: FEWER, rows: [], hidden: true });
  });

  it("counts one answer under the same rule", () => {
    const raw = rows("gender", 30, { Woman: 9, Man: 21 });
    expect(countOf(raw, "gender", "Woman")).toBe(FEWER);
    expect(countOf(raw, "gender", "Man")).toBe(21);
    expect(countOf(raw, "gender", "Other")).toBe(FEWER);
  });

  it("allows a cross-tab only when every cell, empty ones included, is at least 10", () => {
    const ok = crossTab([{ a: "Woman", b: "No", n: 12 }, { a: "Woman", b: "Yes", n: 10 }, { a: "Man", b: "No", n: 15 }, { a: "Man", b: "Yes", n: 11 }], ["Woman", "Man"], ["No", "Yes"]);
    expect(ok.allowed).toBe(true);
    expect(crossTab([{ a: "Woman", b: "No", n: 12 }, { a: "Woman", b: "Yes", n: 9 }, { a: "Man", b: "No", n: 15 }, { a: "Man", b: "Yes", n: 11 }], ["Woman", "Man"], ["No", "Yes"]).allowed).toBe(false);
    expect(crossTab([{ a: "Woman", b: "No", n: 40 }], ["Woman", "Man"], ["No"]).allowed).toBe(false);
  });
});
