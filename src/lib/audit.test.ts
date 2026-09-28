import { describe, expect, it } from "vitest";
import { describeChange } from "./audit";

describe("describeChange", () => {
  it("summarises an edit field by field", () => {
    expect(
      describeChange({
        action: "EDIT",
        before: { angelName: "Jane Doe", ticketGbp: 10_000, note: null },
        after: { angelName: "Jane Doe", ticketGbp: 15_000, note: "via SPV" },
      }),
    ).toBe("Edited Jane Doe: ticket £10,000 to £15,000; note added");
    expect(
      describeChange({
        action: "EDIT",
        before: { angelName: "Sam", interested: true, maxTicketGbp: 5_000, note: "x" },
        after: { angelName: "Sam Lee", interested: false, maxTicketGbp: 0, note: null },
      }),
    ).toBe("Edited Sam: name Sam to Sam Lee; now not interested; max ticket £5,000 to £0; note removed");
  });

  it("describes removals and payment ticks", () => {
    expect(describeChange({ action: "REMOVE", before: { angelName: "Jane", ticketGbp: 2_500, note: null }, after: null })).toBe(
      "Removed Jane (£2,500)",
    );
    expect(describeChange({ action: "PAID", before: { angelName: "Jane", note: null }, after: null })).toBe("Marked Jane as paid");
  });
});
