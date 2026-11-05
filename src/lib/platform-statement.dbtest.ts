// Blue, 2026-11-05: every angel must sign their investor statement on the platform. A
// statement the team recorded (angel page, CSV import) stays on file but gives no access.
// Synthetic database only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { angelHasDealAccess, angelIdsWithDealAccess } from "./portal-deals";

let partner: string;
const stamp = Date.now();
const year = () => new Date(Date.now() + 300 * 86_400_000);

beforeAll(async () => {
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `ps-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
});
afterAll(() => db.$disconnect());

describe("investor statements signed on the platform", () => {
  it("a statement the team recorded doesn't open deals; one the angel signs in the portal does", async () => {
    const angel = await db.angel.create({
      data: {
        name: "Synthetic Onboarded",
        email: `ps-a-${stamp}@example.test`,
        status: "MEMBER",
        onboardedAt: new Date(),
        profileConfirmedAt: new Date(),
        diversityPromptedAt: new Date(),
        createdById: partner,
      },
    });
    await db.user.create({ data: { name: angel.name, email: angel.email!, passwordHash: "x", role: "ANGEL", angelId: angel.id } });
    await db.angelCertification.create({
      data: { angelId: angel.id, type: "HIGH_NET_WORTH", signedOn: new Date(), expiresOn: year(), recordedById: partner, note: "Imported from CSV" },
    });
    expect(await angelHasDealAccess(angel)).toBe(false);
    expect((await angelIdsWithDealAccess()).has(angel.id)).toBe(false);

    await db.angelCertification.create({
      data: {
        angelId: angel.id,
        type: "SELF_CERTIFIED_SOPHISTICATED",
        signedOn: new Date(),
        expiresOn: year(),
        recordedById: partner,
        signedByAngel: true,
        criteria: ["x"],
        signatureName: "Synthetic Onboarded",
      },
    });
    expect(await angelHasDealAccess(angel)).toBe(true);
    expect((await angelIdsWithDealAccess()).has(angel.id)).toBe(true);
  });
});
