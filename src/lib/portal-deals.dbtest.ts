// Members' voting limits, deadlines, the £25k progress bar and board highlights, against a
// throwaway database (synthetic people and companies only).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadDealRoom, loadMemberBoard, memberRoundVoting } from "./portal-deals";

let partner: string, me: string;
const deals: Record<string, string> = {};
const others: string[] = [];

beforeAll(async () => {
  const stamp = Date.now();
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `vp-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
  me = (await db.angel.create({ data: { name: "Synthetic Voter", email: `voter-${stamp}@example.test`, createdById: partner } })).id;
  for (let i = 0; i < 6; i++) others.push((await db.angel.create({ data: { name: `Synthetic Angel ${i}`, createdById: partner } })).id);
  const venture = (name: string, round: number, currentStage: "PITCH_SELECTION" | "INVESTMENT_COMMITMENTS") =>
    db.venture
      .create({ data: { name: `${name} ${stamp}`, round, currentStage, sharedWithAngelsAt: new Date(), createdById: partner } })
      .then((v) => (deals[name] = v.id));
  for (const n of ["A", "B", "C", "D"]) await venture(n, 71, "PITCH_SELECTION");
  await venture("Other round", 72, "PITCH_SELECTION");
  await venture("EOI", 71, "INVESTMENT_COMMITMENTS");
  const vote = (ventureId: string, interested: boolean, at: number) =>
    db.preSelectionVote.create({
      data: { ventureId, angelName: "Synthetic Voter", angelId: me, interested, recordedById: partner, createdAt: new Date(stamp + at) },
    });
  await vote(deals.A, true, 1);
  await vote(deals.B, true, 2);
  await vote(deals.C, true, 3);
  await vote(deals.C, false, 4); // changed their mind: frees a vote
  await vote(deals["Other round"], true, 5); // a different round: doesn't count
});
afterAll(() => db.$disconnect());

describe("pitch-selection votes per round", () => {
  it("counts only this round's current yes votes", async () => {
    const v = await memberRoundVoting(me, 71);
    expect([...v.used].sort()).toEqual([deals.A, deals.B].sort());
    expect(v.limit).toBe(3);
  });

  it("uses the deadline only for the round open to members", async () => {
    const closes = new Date(Date.now() + 86_400_000);
    await db.memberRound.create({ data: { round: 71, votingClosesAt: closes, byId: partner } });
    expect((await memberRoundVoting(me, 71)).closesAt?.getTime()).toBe(closes.getTime());
    expect((await memberRoundVoting(me, 72)).closesAt).toBeNull();
    const room = await loadDealRoom(deals.D, me);
    expect(room?.voting?.used.size).toBe(2);
    expect(room?.voting?.closesAt?.getTime()).toBe(closes.getTime());
  });
});

describe("expressions of interest towards £25k", () => {
  const eoi = (angelId: string, maxTicketGbp: number) =>
    db.investmentVote.create({ data: { ventureId: deals.EOI, angelName: "x", angelId, interested: true, maxTicketGbp, recordedById: partner } });

  it("hides the total under 5 interested members, then shows the total only", async () => {
    for (const id of others.slice(0, 4)) await eoi(id, 4_000);
    expect((await loadDealRoom(deals.EOI, me))?.progress).toEqual({ show: false });
    await eoi(me, 6_000);
    const p = (await loadDealRoom(deals.EOI, me))?.progress;
    expect(p).toEqual({ show: true, totalGbp: 22_000, interestedCount: 5, percent: 88, reached: false });
  });

  it("highlights the member's own deals on the board", async () => {
    const board = await loadMemberBoard(me);
    const card = (id: string) => board.cards.find((c) => c.id === id);
    expect(card(deals.EOI)?.involvement).toBe("committed");
    expect(card(deals.EOI)?.progress).toMatchObject({ show: true, totalGbp: 22_000 });
    expect(card(deals.A)?.involvement).toBe("voted");
    expect(card(deals.C)?.involvement).toBeNull();
    expect(card(deals["Other round"])).toBeUndefined(); // not the round open to members
    expect(board.voting.used.size).toBe(2);
  });
});
