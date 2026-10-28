// The eligibility screen worker reads the founders' application answers (synthetic data, fake AI).
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { db } from "@/lib/db";
import { fakeAnthropicClient } from "./deck-ai/mock";
import { runDeckAnalysis } from "./deck-worker";
import { DEFAULT_ELIGIBILITY } from "./playbook/defaults";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
afterAll(async () => {
  await pool.end();
  await db.$disconnect();
});

describe("eligibility screen and the application form", () => {
  it("gives the AI the founders' own answers and founder diversity, and records what it was given", async () => {
    const stamp = Date.now();
    const user = await db.user.create({ data: { name: "Synthetic Partner", email: `fi-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } });
    const v = await db.venture.create({ data: { name: `Synthetic Athletes ${stamp}`, founderDiversity: ["Female Founder"], createdById: user.id } });
    await db.founderSubmission.create({
      data: {
        status: "COMPLETE",
        completionTokenHash: "x",
        companyName: v.name,
        founderNames: "Sam Example",
        email: `founder-${stamp}@example.test`,
        pitch: "Synthetic cycle-aware fuelling app",
        diversityThemes: ["Female Founder", "Immigrant"],
        privacyConsentAt: new Date(),
        diversityConsentAt: new Date(),
        ventureId: v.id,
      },
    });
    const a = await db.deckAnalysis.create({
      data: {
        ventureId: v.id,
        storagePath: `x/${stamp}.pdf`,
        fileName: "deck.pdf",
        fileSize: 100,
        status: "PENDING",
        aiContext: { playbookVersion: 0, playbook: DEFAULT_ELIGIBILITY, lessons: [] },
        createdById: user.id,
      },
    });
    let text = "";
    await runDeckAnalysis(a.id, {
      pool,
      anthropic: fakeAnthropicClient({ onRequest: (p) => (text = JSON.stringify(p)) }),
      readDeck: async () => Buffer.from("%PDF"),
    });
    expect(text).toContain("Synthetic cycle-aware fuelling app");
    expect(text).toContain("Female Founder, Immigrant");
    const done = await db.deckAnalysis.findUniqueOrThrow({ where: { id: a.id } });
    expect(done.status).toBe("COMPLETE");
    expect((done.aiContext as { founderInfo?: string }).founderInfo).toContain("Immigrant");
  });
});
