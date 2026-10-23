// The retention job against a throwaway database (synthetic people only).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runRetention } from "./retention";

let partner: string, stale: string, fresh: string;
const yearsAgo = (y: number) => new Date(Date.now() - y * 365 * 86_400_000);

beforeAll(async () => {
  const stamp = Date.now();
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `p-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
  await db.user.upsert({ where: { id: "system-website" }, update: {}, create: { id: "system-website", email: "website@system.invalid", name: "DXV website", passwordHash: "x", role: "SYSTEM" } });
  stale = (await db.angel.create({ data: { name: "Synthetic Stale", email: `stale-${stamp}@example.test`, createdById: partner, createdAt: yearsAgo(3) } })).id;
  fresh = (await db.angel.create({ data: { name: "Synthetic Fresh", email: `fresh-${stamp}@example.test`, createdById: partner } })).id;
  await db.loginLink.create({ data: { userId: partner, kind: "MAGIC", tokenHash: `old-${stamp}`, expiresAt: yearsAgo(1), requestedIp: "203.0.113.1", createdAt: yearsAgo(1) } });
});
afterAll(() => db.$disconnect());

describe("retention job", () => {
  it("only reports inactive members until RETENTION_DELETE_INACTIVE=on", async () => {
    delete process.env.RETENTION_DELETE_INACTIVE;
    const out = await runRetention();
    expect(out.live).toBe(false);
    expect(out.inactive.wouldWarn).toBeGreaterThanOrEqual(1);
    expect((await db.angel.findUnique({ where: { id: stale } }))?.inactivityWarnedAt).toBeNull();
    expect(out.loginLinksDeleted).toBeGreaterThanOrEqual(1); // link records (with IPs) over 90 days old
  });

  it("when on: warns after 24 months, then erases 30 days after the warning; leaves active members", async () => {
    process.env.RETENTION_DELETE_INACTIVE = "on";
    await runRetention();
    expect((await db.angel.findUnique({ where: { id: stale } }))?.inactivityWarnedAt).not.toBeNull();
    expect((await db.angel.findUnique({ where: { id: fresh } }))?.inactivityWarnedAt).toBeNull();
    await db.angel.update({ where: { id: stale }, data: { inactivityWarnedAt: new Date(Date.now() - 31 * 86_400_000) } });
    await runRetention();
    expect(await db.angel.findUnique({ where: { id: stale } })).toBeNull(); // no history: the record is removed
    expect(await db.angel.findUnique({ where: { id: fresh } })).not.toBeNull();
    delete process.env.RETENTION_DELETE_INACTIVE;
  });
});
