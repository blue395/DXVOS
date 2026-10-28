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
});

describe("eoiProgress counts members by record", () => {
  it("doesn't merge two members who share a name", () => {
    const at = new Date("2026-11-01T10:00:00Z");
    const votes = ["a", "b", "c", "d", "e"].map((id) => ({ angelId: id, angelName: "Sam Smith", interested: true, maxTicketGbp: 5_000, createdAt: at }));
    expect(eoiProgress(votes)).toMatchObject({ show: true, interestedCount: 5, totalGbp: 25_000, reached: true });
  });
});

describe("impactThemeOptions", () => {
  it("puts the Playbook's themes first and adds DXV's wider ones once", async () => {
    const { impactThemeOptions } = await import("./pipeline");
    const out = impactThemeOptions(["FemTech", "Health", "education"]);
    expect(out.slice(0, 3)).toEqual(["FemTech", "Health", "education"]);
    expect(out).toContain("Future of Work");
    expect(out.filter((t) => t.toLowerCase() === "education")).toHaveLength(1);
  });
});

describe("assessmentStatus (Dashboard: Investment Assessment)", () => {
  it("only counts deals at Partner Review or Pitch Selection without an issued memo", async () => {
    const { assessmentStatus } = await import("./pipeline");
    const v = { currentStage: "PARTNER_REVIEW" as const, issued: false, hasReviewDraft: false, aiDrafts: [] as { status: string }[] };
    expect(assessmentStatus(v)).toBe("not-started");
    expect(assessmentStatus({ ...v, currentStage: "PITCH_SELECTION" })).toBe("not-started");
    expect(assessmentStatus({ ...v, currentStage: "ELIGIBILITY_SCREEN" })).toBeNull();
    expect(assessmentStatus({ ...v, issued: true })).toBeNull();
  });
  it("says where it stands: review draft, then drafting, then AI draft ready; failed drafts count as not started", async () => {
    const { assessmentStatus } = await import("./pipeline");
    const v = { currentStage: "PARTNER_REVIEW" as const, issued: false, hasReviewDraft: false };
    expect(assessmentStatus({ ...v, hasReviewDraft: true, aiDrafts: [{ status: "COMPLETE" }] })).toBe("in-review");
    expect(assessmentStatus({ ...v, aiDrafts: [{ status: "PROCESSING" }, { status: "COMPLETE" }] })).toBe("drafting");
    expect(assessmentStatus({ ...v, aiDrafts: [{ status: "COMPLETE" }] })).toBe("ai-draft");
    expect(assessmentStatus({ ...v, aiDrafts: [{ status: "FAILED" }] })).toBe("not-started");
  });
});

describe("memo Round and Stage pills", () => {
  it("offers Not assigned, every round in use and the next one, keeping a memo's own later round", async () => {
    const { memoRoundOptions } = await import("./pipeline");
    expect(memoRoundOptions(4)).toEqual(["Not assigned", "Round 1", "Round 2", "Round 3", "Round 4", "Round 5"]);
    expect(memoRoundOptions(null)).toEqual(["Not assigned", "Round 1"]);
    expect(memoRoundOptions(2, "Round 7")).toHaveLength(8);
  });
  it("reads a chosen pill, or the Other text", async () => {
    const { choiceFrom } = await import("../components/theme-pills");
    const f = new FormData();
    f.set("stage", "__other");
    f.set("stageOther", " Series B ");
    f.set("round", "Round 4");
    expect(choiceFrom(f, "stage")).toBe("Series B");
    expect(choiceFrom(f, "round")).toBe("Round 4");
    expect(choiceFrom(f, "missing")).toBeNull();
  });
});
