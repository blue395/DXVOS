// The opportunities pack worker, and emails carrying a pack, against a throwaway database
// (synthetic people and companies; fake AI; local file storage; emails print, never send).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { db } from "@/lib/db";
import { saveLocalObject } from "./deck-storage";
import { EMAIL_ATTACHMENTS_BUCKET } from "./email-attachments";
import { sendNextBatch } from "./member-emails";
import { DEFAULT_ASSESSMENT } from "./playbook/defaults";
import type { OpportunityContext } from "./opportunities/context";
import { fakeOpportunityClient } from "./opportunities/mock";
import type { OpportunityContent } from "./opportunities/schema";
import { runOpportunityPack } from "./opportunity-worker";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let partner: string;
const stamp = Date.now();

beforeAll(async () => {
  process.env.SESSION_SECRET ??= "synthetic-test-secret-for-signed-unsubscribe-links";
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `op-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
});
afterAll(async () => {
  await pool.end();
  await db.$disconnect();
});

const dealCtx = (ventureId: string, name: string) => ({
  ventureId,
  name,
  sector: "Climate",
  stage: "Seed",
  raise: null,
  oneLiner: null,
  founderDiversity: [],
  membersSummary: null,
  memo: null,
  deck: { storagePath: `x/${name}.pdf`, fileName: "deck.pdf" },
});

describe("runOpportunityPack", () => {
  it("drafts every company, marks a failure, and keeps the title", async () => {
    const context: OpportunityContext = {
      round: 91,
      themes: ["Climate"],
      deals: [dealCtx("v1", "Alpha Synthetic"), dealCtx("v2", "Beta Synthetic")],
      ai: { playbookVersion: 0, playbook: DEFAULT_ASSESSMENT, lessons: [] },
    };
    const p = await db.opportunityPack.create({
      data: { round: 91, number: 1, title: "Syndicate Opportunities, November 2026", context, createdById: partner },
    });
    await runOpportunityPack(p.id, { pool, anthropic: fakeOpportunityClient({ fail: ["Beta Synthetic"] }), readDeck: async () => Buffer.from("%PDF") });
    const done = await db.opportunityPack.findUniqueOrThrow({ where: { id: p.id } });
    expect(done.status).toBe("COMPLETE");
    const c = done.content as OpportunityContent;
    expect(c.title).toBe("Syndicate Opportunities, November 2026");
    expect(c.deals[0].summary).toContain("Alpha Synthetic");
    expect(c.deals[1].error).toMatch(/Simulated failure/);
  });
});

describe("emails carrying an opportunities pack", () => {
  it("go only to members with a current investor statement, with the PDF attached", async () => {
    const member = await db.angel.create({
      data: {
        name: "Synthetic Member",
        email: `m-${stamp}@example.test`,
        status: "MEMBER",
        onboardedAt: new Date(),
        profileConfirmedAt: new Date(),
        createdById: partner,
      },
    });
    await db.user.create({ data: { name: member.name, email: member.email!, passwordHash: "x", role: "ANGEL", angelId: member.id } });
    await db.angelCertification.create({
      data: {
        angelId: member.id,
        type: "HIGH_NET_WORTH",
        signedOn: new Date(),
        expiresOn: new Date(Date.now() + 86_400_000 * 300),
        recordedById: partner,
        criteria: [],
        signedByAngel: true, // only a statement signed in the portal counts (Blue, 2026-11-05)
      },
    });
    const prospect = await db.angel.create({
      data: { name: "Synthetic Prospect", email: `p-${stamp}@example.test`, status: "PROSPECT", createdById: partner },
    });
    const pack = await db.opportunityPack.create({
      data: {
        round: 92,
        number: 1,
        title: "T",
        status: "COMPLETE",
        context: {},
        content: { title: "T", deals: [] },
        approvedAt: new Date(),
        createdById: partner,
      },
    });
    const email = await db.memberEmail.create({
      data: {
        subject: "Opportunities",
        body: "Hello {{first_name}}, see {{platform_link}}",
        audience: "all-members",
        createdById: partner,
        recipients: {
          create: [
            { angelId: member.id, email: member.email! },
            { angelId: prospect.id, email: prospect.email! },
          ],
        },
      },
    });
    const path = `pack-${stamp}.pdf`;
    await saveLocalObject(EMAIL_ATTACHMENTS_BUCKET, path, Buffer.from("%PDF-1.4 synthetic"));
    await db.memberEmailAttachment.create({
      data: {
        memberEmailId: email.id,
        fileName: "pack.pdf",
        mimeType: "application/pdf",
        sizeBytes: 18,
        bucket: EMAIL_ATTACHMENTS_BUCKET,
        storagePath: path,
        uploadedAt: new Date(),
        opportunityPackId: pack.id,
        createdById: partner,
      },
    });
    const r = await sendNextBatch(email.id, partner);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
    const rows = await db.memberEmailRecipient.findMany({ where: { memberEmailId: email.id } });
    expect(rows.find((x) => x.angelId === member.id)?.status).toBe("SENT");
    expect(rows.find((x) => x.angelId === prospect.id)?.error).toMatch(/investor statement/);
  });
});
