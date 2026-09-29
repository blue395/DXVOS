import { describe, expect, it } from "vitest";
import { guessMapping, mapRow, parseCertType, parseCsv, parseImportDate, parseStatus } from "./angel-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines inside fields, CRLF and a BOM", () => {
    const csv = '﻿Name,Email,Bio\r\n"Walker, Kevin",k@x.com,"Said ""yes""\nto fintech"\r\n\r\nAda,a@x.com,\n';
    expect(parseCsv(csv)).toEqual([
      ["Name", "Email", "Bio"],
      ["Walker, Kevin", "k@x.com", 'Said "yes"\nto fintech'],
      ["Ada", "a@x.com", ""],
    ]);
  });
});

describe("guessMapping", () => {
  it("guesses a Squarespace-style header row", () => {
    expect(
      guessMapping(["First Name", "Last Name", "Email Address", "Phone", "Sectors of interest", "Investor type", "Date signed", "How did you hear about us?", "Submitted On"]),
    ).toEqual(["firstName", "lastName", "email", "phone", "sectors", "certType", "certSignedOn", "source", "joinedAt"]);
  });
});

describe("value parsing", () => {
  it("reads UK dates day-first, ISO and written dates, rejecting nonsense", () => {
    const iso = (s: string) => parseImportDate(s)?.toISOString().slice(0, 10);
    expect(iso("03/10/2026")).toBe("2026-10-03");
    expect(iso("2026-10-03")).toBe("2026-10-03");
    expect(iso("3 Oct 2026")).toBe("2026-10-03");
    expect(iso("31/02/2026")).toBeUndefined();
    expect(parseImportDate("")).toBeNull();
  });
  it("reads certification types and statuses", () => {
    expect(parseCertType("High Net Worth Individual")).toBe("HIGH_NET_WORTH");
    expect(parseCertType("HNW")).toBe("HIGH_NET_WORTH");
    expect(parseCertType("Self-certified sophisticated investor")).toBe("SELF_CERTIFIED_SOPHISTICATED");
    expect(parseCertType("Sophisticated investor")).toBe("SELF_CERTIFIED_SOPHISTICATED");
    expect(parseCertType("Certified sophisticated investor")).toBe("CERTIFIED_SOPHISTICATED");
    expect(parseCertType("Restricted investor")).toBeNull();
    expect(parseStatus("Active member")).toBe("MEMBER");
    expect(parseStatus("Lapsed")).toBe("LAPSED");
    expect(parseStatus("Prospect")).toBe("PROSPECT");
    expect(parseStatus("")).toBeNull();
  });
});

describe("mapRow", () => {
  const mapping = guessMapping(["First Name", "Last Name", "Email", "Investor type", "Date signed"]);
  it("builds an import row", () => {
    expect(mapRow(["Chloe", "Davies", " Chloe@X.com ", "HNW", "01/10/2026"], mapping)).toMatchObject({
      name: "Chloe Davies",
      email: "chloe@x.com",
      certType: "HIGH_NET_WORTH",
      certSignedOn: "2026-10-01T12:00:00.000Z",
    });
  });
  it("skips rows with no name or email, and drops invalid emails", () => {
    expect(mapRow(["", "", "", "", ""], mapping)).toBeNull();
    expect(mapRow(["Chloe", "", "not-an-email", "", ""], mapping)).toMatchObject({ name: "Chloe", email: null });
  });
});
