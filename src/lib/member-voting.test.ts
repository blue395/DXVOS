import { describe, expect, it } from "vitest";
import {
  boardInvolvement,
  dateToLondonLocal,
  eoiProgress,
  EOI_MINIMUM_GBP,
  londonLocalToDate,
  lumaLink,
  preSelectionVoteRefusal,
  preSelectionVotesUsed,
  upcomingEvents,
} from "./pipeline";

const t = (s: string) => new Date(s);

describe("pitch-selection votes: 3 per round", () => {
  const votes = [
    { ventureId: "a", interested: true, createdAt: t("2026-11-01T10:00:00Z") },
    { ventureId: "b", interested: true, createdAt: t("2026-11-01T10:01:00Z") },
    { ventureId: "c", interested: true, createdAt: t("2026-11-01T10:02:00Z") },
    { ventureId: "c", interested: false, createdAt: t("2026-11-01T11:00:00Z") }, // changed their mind
    { ventureId: "d", interested: false, createdAt: t("2026-11-01T10:03:00Z") },
  ];
  const round = { number: 4, closesAt: t("2026-11-10T18:00:00Z") };
  const now = t("2026-11-02T09:00:00Z");

  it("counts each deal's latest answer, yes only", () => {
    expect([...preSelectionVotesUsed(votes)].sort()).toEqual(["a", "b"]);
  });
  it("allows a third yes, refuses a fourth", () => {
    const used = preSelectionVotesUsed(votes);
    expect(preSelectionVoteRefusal({ ventureId: "d", interested: true }, used, round, now)).toBeNull();
    const full = new Set([...used, "d"]);
    expect(preSelectionVoteRefusal({ ventureId: "e", interested: true }, full, round, now)).toMatch(/used your 3 votes/);
  });
  it("lets members change a vote: yes again on a deal they already chose, or no to free a slot", () => {
    const full = new Set(["a", "b", "d"]);
    expect(preSelectionVoteRefusal({ ventureId: "a", interested: true }, full, round, now)).toBeNull();
    expect(preSelectionVoteRefusal({ ventureId: "a", interested: false }, full, round, now)).toBeNull();
  });
  it("closes at the deadline", () => {
    expect(preSelectionVoteRefusal({ ventureId: "a", interested: false }, new Set(), round, t("2026-11-10T18:00:00Z"))).toMatch(/closed/);
    expect(preSelectionVoteRefusal({ ventureId: "a", interested: true }, new Set(), { number: 4, closesAt: null }, now)).toBeNull();
  });
});

describe("eoiProgress (members' bar towards £25k)", () => {
  const eoi = (angelName: string, maxTicketGbp: number, interested = true, at = "2026-11-01T10:00:00Z") => ({
    angelName,
    interested,
    maxTicketGbp,
    createdAt: t(at),
  });
  it("is £25k", () => expect(EOI_MINIMUM_GBP).toBe(25_000));
  it("stays hidden under 5 interested members", () => {
    expect(eoiProgress([eoi("A", 10_000), eoi("B", 10_000), eoi("C", 1_000), eoi("D", 1_000)])).toEqual({ show: false });
    expect(eoiProgress([eoi("A", 1), eoi("B", 1), eoi("C", 1), eoi("D", 1), eoi("E", 0, false)])).toEqual({ show: false });
  });
  it("adds each member's latest answer", () => {
    const p = eoiProgress([
      eoi("A", 5_000),
      eoi("B", 2_000),
      eoi("C", 3_000),
      eoi("D", 2_500),
      eoi("E", 2_500),
      eoi("A", 0, false, "2026-11-02T10:00:00Z"),
      eoi("F", 1_000),
    ]);
    expect(p).toEqual({ show: true, totalGbp: 11_000, interestedCount: 5, percent: 44, reached: false });
  });
  it("caps at 100% once reached", () => {
    const p = eoiProgress(["A", "B", "C", "D", "E"].map((n) => eoi(n, 10_000)));
    expect(p).toMatchObject({ percent: 100, reached: true, totalGbp: 50_000 });
  });
});

describe("boardInvolvement", () => {
  it("shows the strongest involvement", () => {
    expect(boardInvolvement({ paidTicket: true, committed: true, votedYes: true })).toBe("invested");
    expect(boardInvolvement({ paidTicket: false, committed: true, votedYes: false })).toBe("committed");
    expect(boardInvolvement({ paidTicket: false, committed: false, votedYes: true })).toBe("voted");
    expect(boardInvolvement({ paidTicket: false, committed: false, votedYes: false })).toBeNull();
  });
});

describe("UK times typed by the team", () => {
  it("reads winter (GMT) and summer (BST) times", () => {
    expect(londonLocalToDate("2026-12-03T18:30")?.toISOString()).toBe("2026-12-03T18:30:00.000Z");
    expect(londonLocalToDate("2026-07-03T18:30")?.toISOString()).toBe("2026-07-03T17:30:00.000Z");
  });
  it("round-trips for the form", () => {
    for (const s of ["2026-12-03T18:30", "2026-07-03T09:05", "2026-03-29T03:00", "2026-10-25T12:00"]) expect(dateToLondonLocal(londonLocalToDate(s)!)).toBe(s);
  });
  it("refuses anything else", () => {
    expect(londonLocalToDate("next Tuesday")).toBeNull();
    expect(londonLocalToDate("")).toBeNull();
  });
});

describe("events", () => {
  it("accepts only https Luma links", () => {
    expect(lumaLink("https://lu.ma/dxv-pitch")).toBe("https://lu.ma/dxv-pitch");
    expect(lumaLink(" https://luma.com/event/abc ")).toBe("https://luma.com/event/abc");
    expect(lumaLink("http://lu.ma/x")).toBeNull();
    expect(lumaLink("https://lu.ma.evil.com/x")).toBeNull();
    expect(lumaLink("https://user@lu.ma/x")).toBeNull();
    expect(lumaLink("javascript:alert(1)")).toBeNull();
  });
  it("lists what's coming up, soonest first, hiding archived and long-past events", () => {
    const now = t("2026-11-05T20:00:00Z");
    const ev = (id: string, at: string, archived = false) => ({ id, startsAt: t(at), archivedAt: archived ? now : null });
    const out = upcomingEvents(
      [
        ev("later", "2026-12-01T18:00:00Z"),
        ev("tonight", "2026-11-05T18:00:00Z"),
        ev("past", "2026-11-04T18:00:00Z"),
        ev("gone", "2026-11-20T18:00:00Z", true),
      ],
      now,
    );
    expect(out.map((e) => e.id)).toEqual(["tonight", "later"]);
  });
});

describe("portfolio tidy-ups", () => {
  it("says Not known rather than £0 when no scheme is recorded", async () => {
    const { reliefDisplay } = await import("./pipeline");
    expect(reliefDisplay({ reliefMinor: 0, reliefUnknown: 2 }).value).toBeNull();
    expect(reliefDisplay({ reliefMinor: 0, reliefUnknown: 0 }).value).toBe("£0");
    expect(reliefDisplay({ reliefMinor: 150_000, reliefUnknown: 1 })).toEqual({ value: "£1,500", note: "1 investment without a scheme not included" });
  });
  it("expects a share certificate about 8 weeks after investing", async () => {
    const { shareCertExpectedBy } = await import("./pipeline");
    expect(shareCertExpectedBy(t("2026-11-01T00:00:00Z"))?.toISOString()).toBe("2026-12-27T00:00:00.000Z");
    expect(shareCertExpectedBy(null)).toBeNull();
  });
});

describe("eoiProgress counts members by record", () => {
  it("doesn't merge two members who share a name", () => {
    const at = new Date("2026-11-01T10:00:00Z");
    const votes = ["a", "b", "c", "d", "e"].map((id) => ({ angelId: id, angelName: "Sam Smith", interested: true, maxTicketGbp: 5_000, createdAt: at }));
    expect(eoiProgress(votes)).toMatchObject({ show: true, interestedCount: 5, totalGbp: 25_000, reached: true });
  });
});
