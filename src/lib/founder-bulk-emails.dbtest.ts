// Partners' emails to several founders, against a throwaway database (synthetic companies;
// emails print, never send).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveLocalObject } from "./deck-storage";
import { EMAIL_ATTACHMENTS_BUCKET } from "./email-attachments";
import { founderRecipients, sendNextFounderBatch } from "./founder-bulk-emails";

let partner: string;
const stamp = Date.now();
const venture = (name: string, currentStage: "PITCH_SELECTION" | "PITCH_OUTCOME" | "PASSED", founderEmail: string | null) =>
  db.venture.create({
    data: { name: `${name} ${stamp}`, founderNames: `${name}a Founder & Co Founder`, founderEmail, currentStage, round: 77, createdById: partner },
  });

beforeAll(async () => {
  partner = (await db.user.create({ data: { name: "Synthetic Partner", email: `fb-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
});
afterAll(async () => {
  await db.$disconnect();
});

describe("emails to founders", () => {
  it("go only to the chosen, matching deals, once each, with a copy kept on each deal", async () => {
    const a = await venture("Alph", "PITCH_SELECTION", `alpha-${stamp}@example.test`);
    const b = await venture("Bet", "PITCH_SELECTION", `beta-${stamp}@example.test`);
    const declined = await venture("Gamm", "PASSED", `gamma-${stamp}@example.test`);
    const noEmail = await venture("Delt", "PITCH_SELECTION", null);
    const other = await venture("Epsil", "PITCH_OUTCOME", `eps-${stamp}@example.test`);

    // The page's list is only a suggestion: the server re-applies the filter.
    const people = await founderRecipients({ round: 77, stages: ["PITCH_SELECTION"], includeDeclined: false }, [a.id, b.id, declined.id, noEmail.id, other.id]);
    expect(people.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());

    const email = await db.founderBulkEmail.create({
      data: {
        subject: "Pitching to DXV: {{company}}",
        body: "Hi {{first_name}},\n\nSee you at the session.",
        audience: "Round 77 · Member Pitch Selection",
        createdById: partner,
        recipients: { create: people.map((v) => ({ ventureId: v.id, email: v.email })) },
      },
    });
    const path = `founder-${stamp}.pdf`;
    await saveLocalObject(EMAIL_ATTACHMENTS_BUCKET, path, Buffer.from("%PDF-1.4 synthetic"));
    await db.memberEmailAttachment.create({
      data: {
        founderBulkEmailId: email.id,
        fileName: "agenda.pdf",
        mimeType: "application/pdf",
        sizeBytes: 18,
        bucket: EMAIL_ATTACHMENTS_BUCKET,
        storagePath: path,
        uploadedAt: new Date(),
        createdById: partner,
      },
    });

    // Two tabs sending at once can't send anyone two copies.
    const [r1, r2] = await Promise.all([sendNextFounderBatch(email.id, partner), sendNextFounderBatch(email.id, partner)]);
    expect(Math.max(r1.sent, r2.sent)).toBe(2);
    expect(r2.pending + r1.pending).toBe(0);

    const copies = await db.founderEmail.findMany({ where: { bulkEmailId: email.id }, orderBy: { to: "asc" } });
    expect(copies).toHaveLength(2);
    expect(copies.every((c) => c.kind === "BULK" && c.sentById === partner && !c.error)).toBe(true);
    expect(copies[0].ventureId).toBe(a.id);
    expect(copies[0].subject).toBe(`Pitching to DXV: Alph ${stamp}`);
    expect(copies[0].body).toContain("Hi Alpha,");
    expect(await db.founderEmail.count({ where: { ventureId: { in: [declined.id, noEmail.id, other.id] } } })).toBe(0);
  });
});
