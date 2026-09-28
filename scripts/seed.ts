// DEV ONLY: demo admin + sample ventures across the pipeline.
//   npm run db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { LINEAR_STAGES, stageIndex } from "@/lib/pipeline";
import { moveVentureStage } from "@/lib/ventures";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const DEV_EMAIL = "admin@dxv.local";
const DEV_PASSWORD = "dxv-dev-password";

const SAMPLES: { name: string; sector: string; founderNames: string; stage: Stage; passReason?: PassReason }[] = [
  { name: "Kora Health", sector: "Healthtech", founderNames: "Amara Okafor", stage: "SUBMITTED" },
  { name: "Loop Lending", sector: "Fintech", founderNames: "Priya Shah", stage: "ELIGIBILITY_SCREEN" },
  { name: "Tessellate", sector: "Climate", founderNames: "Jordan Mensah", stage: "PARTNER_REVIEW" },
  { name: "Halo Learning", sector: "Edtech", founderNames: "Sofia Reyes", stage: "PARTNER_REVIEW" },
  { name: "Brightside Care", sector: "Care", founderNames: "Kemi Adeyemi", stage: "PITCH_SELECTION" },
  { name: "Northstar Logistics", sector: "Logistics", founderNames: "Omar Haddad", stage: "PITCH_OUTCOME" },
  { name: "Verdant Foods", sector: "Food", founderNames: "Lina Chen", stage: "INVESTMENT_COMMITMENTS" },
  { name: "Mosaic Pay", sector: "Fintech", founderNames: "Daniel Asante", stage: "DUE_DILIGENCE" },
  { name: "Fable Robotics", sector: "Deeptech", founderNames: "Hana Ito", stage: "CAPITAL_TRANSFER" },
  { name: "Ember Energy", sector: "Climate", founderNames: "Grace Nwosu", stage: "SEIS_CERTIFICATE" },
  { name: "Quill Legal", sector: "Legaltech", founderNames: "Sam Patel", stage: "PASSED", passReason: "VALUATION_GAP" },
];

async function main() {
  const admin = await db.user.upsert({
    where: { email: DEV_EMAIL },
    create: { email: DEV_EMAIL, name: "Dev Admin", passwordHash: await bcrypt.hash(DEV_PASSWORD, 12) },
    update: {},
  });

  for (const s of SAMPLES) {
    if (await db.venture.findFirst({ where: { name: s.name } })) continue;

    const v = await db.venture.create({
      data: {
        name: s.name,
        sector: s.sector,
        founderNames: s.founderNames,
        companyStage: "Pre-seed",
        round: 1 + (SAMPLES.indexOf(s) % 3),
        deckUrl: "https://drive.google.com/",
        createdById: admin.id,
        stageChanges: { create: { fromStage: null, toStage: "SUBMITTED", changedById: admin.id } },
      },
    });

    // Walk it forward one stage at a time, like a real deal would move.
    const target = s.stage === "PASSED" ? "PITCH_SELECTION" : s.stage;
    for (const stage of LINEAR_STAGES.slice(1, stageIndex(target) + 1)) {
      await moveVentureStage({ ventureId: v.id, to: stage.key, userId: admin.id });
    }
    if (s.stage === "PASSED") {
      await moveVentureStage({ ventureId: v.id, to: "PASSED", userId: admin.id, passReason: s.passReason });
    }
  }

  // Some deal-review content on the EOI and DD deals.
  const verdant = await db.venture.findFirstOrThrow({ where: { name: "Verdant Foods" } });
  if ((await db.investmentVote.count({ where: { ventureId: verdant.id } })) === 0) {
    await db.investmentVote.createMany({
      data: [
        { ventureId: verdant.id, angelName: "Ada Lovelace", interested: true, maxTicketGbp: 5000, recordedById: admin.id },
        { ventureId: verdant.id, angelName: "Grace Hopper", interested: true, maxTicketGbp: 7500, recordedById: admin.id },
        { ventureId: verdant.id, angelName: "Alan Turing", interested: false, maxTicketGbp: 0, recordedById: admin.id },
      ],
    });
    await db.preSelectionVote.createMany({
      data: [
        { ventureId: verdant.id, angelName: "Ada Lovelace", interested: true, recordedById: admin.id },
        { ventureId: verdant.id, angelName: "Grace Hopper", interested: true, recordedById: admin.id },
      ],
    });
  }

  const mosaic = await db.venture.findFirstOrThrow({ where: { name: "Mosaic Pay" } });
  if ((await db.dDItem.count({ where: { ventureId: mosaic.id } })) === 0) {
    const day = 24 * 60 * 60 * 1000;
    await db.dDItem.createMany({
      data: [
        { ventureId: mosaic.id, title: "Cap table review", owner: "Kevin", dueDate: new Date(Date.now() - 2 * day) },
        { ventureId: mosaic.id, title: "Founder references", owner: "Anna", dueDate: new Date(Date.now() + 5 * day) },
        { ventureId: mosaic.id, title: "FCA permissions check", completedAt: new Date() },
      ],
    });
    await db.memoVersion.create({
      data: { ventureId: mosaic.id, version: 1, docUrl: "https://docs.google.com/", summary: "First draft", createdById: admin.id },
    });
  }

  console.log(`Seeded. Dev login: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
}

main().finally(() => db.$disconnect());
