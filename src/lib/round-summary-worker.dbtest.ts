// The round summary worker against a throwaway database (synthetic deals; fake AI).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { db } from "@/lib/db";
import { DEFAULT_ASSESSMENT } from "./playbook/defaults";
import type { RoundSummaryContext } from "./round-summary/context";
import { fakeSummaryClient } from "./round-summary/mock";
import type { RoundSummaryContent } from "./round-summary/schema";
import { runRoundSummary } from "./round-summary-worker";

let partner: string;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const facts = { oneLiner: null, sector: "Fintech", stage: "Seed", raise: null, eligibility: null, memoScore: null };
const context: RoundSummaryContext = {
  round: 81,
  deals: [
    {
      ventureId: "v1",
      name: "Alpha Synthetic",
      facts,
      details: {},
      eligibilityScreen: null,
      eligibilityDecisions: [],
      memo: null,
      deck: { storagePath: "d/1.pdf", fileName: "1.pdf" },
    },
    {
      ventureId: "v2",
      name: "Beta Synthetic",
      facts,
      details: {},
      eligibilityScreen: null,
      eligibilityDecisions: [],
      memo: null,
      deck: { storagePath: "d/2.pdf", fileName: "2.pdf" },
    },
  ],
  ai: { playbookVersion: 0, playbook: DEFAULT_ASSESSMENT, lessons: [] },
};

beforeAll(async () => {
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `rs-${Date.now()}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
});
afterAll(async () => {
  await pool.end();
  await db.$disconnect();
});

describe("runRoundSummary", () => {
  it("summarises every deal, keeps going when one fails, and carries partner notes to the next version", async () => {
    const s1 = await db.roundSummary.create({ data: { round: 81, number: 1, context, createdById: partner } });
    await runRoundSummary(s1.id, { pool, anthropic: fakeSummaryClient({ fail: ["Beta Synthetic"] }), readDeck: async () => Buffer.from("%PDF") });
    const done = await db.roundSummary.findUniqueOrThrow({ where: { id: s1.id } });
    expect(done.status).toBe("COMPLETE");
    const c = done.content as RoundSummaryContent;
    expect(c.deals[0].headline).toContain("Alpha Synthetic");
    expect(c.deals[1].error).toMatch(/Simulated failure/);

    c.deals[0].partnerView = "Bring to pitch";
    c.deals[0].takeToPitch = "STRONG_YES";
    await db.roundSummary.update({ where: { id: s1.id }, data: { content: c, editedAt: new Date(), updatedById: partner } });

    const s2 = await db.roundSummary.create({ data: { round: 81, number: 2, context, createdById: partner } });
    await runRoundSummary(s2.id, { pool, anthropic: fakeSummaryClient(), readDeck: async () => Buffer.from("%PDF") });
    const c2 = (await db.roundSummary.findUniqueOrThrow({ where: { id: s2.id } })).content as RoundSummaryContent;
    expect(c2.deals[0]).toMatchObject({ partnerView: "Bring to pitch", takeToPitch: "STRONG_YES" });
    expect(c2.deals[1].error).toBeNull();
  });

  it("fails the job when no deal can be summarised, with the reason", async () => {
    const s = await db.roundSummary.create({ data: { round: 82, number: 1, context, createdById: partner } });
    await runRoundSummary(s.id, { pool, anthropic: fakeSummaryClient({ fail: ["Synthetic"] }), readDeck: async () => Buffer.from("%PDF") });
    const r = await db.roundSummary.findUniqueOrThrow({ where: { id: s.id } });
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatch(/Simulated failure/);
  });
});
