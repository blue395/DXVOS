// Security audit (Blue, 2026-11-05): attempts to read other people's data, against a
// throwaway database with synthetic people and companies only. Every test here is an
// attacker's move and must come back empty.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadMyDiversity, saveMyDiversity } from "./diversity/store";
import { loadPortfolio } from "./portfolio";
import { angelMayOpenDocument, loadDealRoom, loadMemberBoard } from "./portal-deals";

const stamp = Date.now();
let partner: string, alice: string, bob: string;
const v: Record<string, string> = {};
const d: Record<string, string> = {};

const form = (pairs: [string, string][]) => {
  const f = new FormData();
  for (const [k, val] of pairs) f.append(k, val);
  return f;
};

beforeAll(async () => {
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `xp-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
  const member = (name: string) =>
    db.angel
      .create({
        data: {
          name,
          email: `${name.toLowerCase().replace(/\W/g, "")}-${stamp}@example.test`,
          status: "MEMBER",
          onboardedAt: new Date(),
          profileConfirmedAt: new Date(),
          createdById: partner,
          certifications: {
            create: { type: "HIGH_NET_WORTH", signedOn: new Date(), expiresOn: new Date(Date.now() + 300 * 86_400_000), recordedById: partner },
          },
        },
      })
      .then((a) => a.id);
  alice = await member("Synthetic Alice");
  bob = await member("Synthetic Bob");

  const venture = (
    key: string,
    data: { currentStage: "PARTNER_REVIEW" | "PITCH_SELECTION" | "DUE_DILIGENCE" | "PASSED"; shared: boolean; passedFromStage?: "PITCH_SELECTION" },
  ) =>
    db.venture
      .create({
        data: {
          name: `X ${key} ${stamp}`,
          round: 81,
          currentStage: data.currentStage,
          passedFromStage: data.passedFromStage,
          sharedWithAngelsAt: data.shared ? new Date() : null,
          createdById: partner,
        },
      })
      .then((x) => (v[key] = x.id));
  await venture("unshared", { currentStage: "PITCH_SELECTION", shared: false });
  await venture("review", { currentStage: "PARTNER_REVIEW", shared: true }); // shared but still with the team
  await venture("declined", { currentStage: "PASSED", shared: true, passedFromStage: "PITCH_SELECTION" });
  await venture("dd", { currentStage: "DUE_DILIGENCE", shared: true });

  const doc = (key: string, ventureId: string, category: "DECK" | "DUE_DILIGENCE" | "FINANCIALS") =>
    db.document
      .create({
        data: {
          ventureId,
          category,
          angelVisibleFrom: category === "DUE_DILIGENCE" ? "DUE_DILIGENCE" : undefined,
          bucket: "documents",
          storagePath: `x/${key}.pdf`,
          fileName: `${key}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 10,
          uploadedAt: new Date(),
          uploadedById: partner,
        },
      })
      .then((x) => (d[key] = x.id));
  await doc("unsharedDeck", v.unshared, "DECK");
  await doc("reviewDeck", v.review, "DECK");
  await doc("declinedDeck", v.declined, "DECK");
  await doc("ddReport", v.dd, "DUE_DILIGENCE");

  // Alice committed to the DD deal (interested EOI); Bob didn't.
  await db.investmentVote.create({
    data: { ventureId: v.dd, angelName: "Synthetic Alice", angelId: alice, interested: true, maxTicketGbp: 5_000, recordedById: partner },
  });

  // Alice's private portfolio entry, outside DXV.
  await db.portfolioHolding.create({ data: { angelId: alice, companyName: `Alice Private Co ${stamp}`, currency: "GBP" } as never });
});
afterAll(() => db.$disconnect());

describe("Supabase Data API: an anonymous visitor reads every table", () => {
  it("gets zero rows from every table in the database", async () => {
    // A stand-in for Supabase's `anon` / `authenticated` roles: may SELECT everything, but is
    // not the owner and can't bypass row-level security. With RLS on, it must see nothing.
    const tables: { relname: string }[] = await db.$queryRawUnsafe(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'`,
    );
    expect(tables.length).toBeGreaterThan(50);
    const seen: string[] = [];
    await db.$executeRawUnsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_anon') THEN CREATE ROLE audit_anon NOLOGIN NOBYPASSRLS; END IF; END $$`,
    );
    await db.$executeRawUnsafe(`GRANT audit_anon TO CURRENT_USER`);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO audit_anon`);
    await db.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO audit_anon`);
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE audit_anon`);
      for (const { relname } of tables) {
        const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${relname}"`);
        if (n > BigInt(0)) seen.push(`${relname}: ${n}`);
      }
      await tx.$executeRawUnsafe(`RESET ROLE`);
    });
    expect(seen).toEqual([]);
  });
});

describe("one member trying to see what they shouldn't", () => {
  it("can't open a deal DXV hasn't shared, one still with the team, or a declined one", async () => {
    expect(await loadDealRoom(v.unshared, bob)).toBeNull();
    expect(await loadDealRoom(v.review, bob)).toBeNull();
    expect(await loadDealRoom(v.declined, bob)).toBeNull();
  });

  it("can't open their documents by guessing the document id", async () => {
    expect(await angelMayOpenDocument(d.unsharedDeck, bob)).toBeNull();
    expect(await angelMayOpenDocument(d.reviewDeck, bob)).toBeNull();
    expect(await angelMayOpenDocument(d.declinedDeck, bob)).toBeNull();
  });

  it("can't open due diligence documents for a deal they didn't commit to (the member who did can)", async () => {
    expect(await angelMayOpenDocument(d.ddReport, bob)).toBeNull();
    expect(await angelMayOpenDocument(d.ddReport, alice)).not.toBeNull();
  });

  it("never sees declined deals, or other members' votes, on the board", async () => {
    const board = await loadMemberBoard(bob);
    const text = JSON.stringify(board);
    expect(text).not.toContain(v.declined);
    expect(text).not.toContain("Synthetic Alice");
  });

  it("can't see another member's private portfolio", async () => {
    const mine = await loadPortfolio(bob);
    expect(JSON.stringify(mine)).not.toContain(`Alice Private Co ${stamp}`);
    expect(JSON.stringify(await loadPortfolio(alice))).toContain(`Alice Private Co ${stamp}`);
  });

  it("can't read another member's diversity answers through the member role", async () => {
    await saveMyDiversity(
      alice,
      form([
        ["q_gender", "Woman"],
        ["consent_gender_background", "on"],
      ]),
      "profile_edit",
    );
    const bobs = await loadMyDiversity(bob);
    expect(bobs.answers).toEqual([]);
    // Raw cross-member SQL as the member role is tested in src/lib/diversity/store.dbtest.ts (only that folder may name those tables).
  });
});
