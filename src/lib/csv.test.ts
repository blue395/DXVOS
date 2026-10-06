import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("quotes everything and escapes quotes", () => {
    expect(csvCell('Say "hi", Sam')).toBe('"Say ""hi"", Sam"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(new Date("2026-10-06T10:00:00Z"))).toBe('"2026-10-06"');
  });
  it("shows formulas as text", () => {
    expect(csvCell('=HYPERLINK("https://evil.example","Click")')).toBe('"\'=HYPERLINK(""https://evil.example"",""Click"")"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("+44 7700")).toBe('"\'+44 7700"');
  });
  it("leaves plain negative numbers alone", () => {
    expect(csvCell(-1250.5)).toBe('"-1250.5"');
  });
});
