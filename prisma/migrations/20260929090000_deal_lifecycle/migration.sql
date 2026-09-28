-- Deal lifecycle batch (2026-09-29): Final Investment, editable EOIs with an audit log,
-- lead angel, declined-at stage, and Capital Transfer retired.

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('INVESTMENT_VOTE', 'FINAL_INVESTMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('EDIT', 'REMOVE', 'PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "InvestmentVote" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- AlterTable
ALTER TABLE "Venture" ADD COLUMN     "leadAngel" TEXT,
ADD COLUMN     "passedFromStage" "Stage";

-- CreateTable
CREATE TABLE "FinalInvestment" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "angelName" TEXT NOT NULL,
    "ticketGbp" INTEGER NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "FinalInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryAudit" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinalInvestment_ventureId_createdAt_idx" ON "FinalInvestment"("ventureId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryAudit_ventureId_changedAt_idx" ON "EntryAudit"("ventureId", "changedAt");

-- AddForeignKey
ALTER TABLE "InvestmentVote" ADD CONSTRAINT "InvestmentVote_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalInvestment" ADD CONSTRAINT "FinalInvestment_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalInvestment" ADD CONSTRAINT "FinalInvestment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalInvestment" ADD CONSTRAINT "FinalInvestment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalInvestment" ADD CONSTRAINT "FinalInvestment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryAudit" ADD CONSTRAINT "EntryAudit_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryAudit" ADD CONSTRAINT "EntryAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Row Level Security (no policies): keep the new tables out of Supabase's Data API.
ALTER TABLE "FinalInvestment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntryAudit" ENABLE ROW LEVEL SECURITY;

-- Declined deals: record where in the dealflow they were declined (their latest move to Passed).
UPDATE "Venture" v
SET "passedFromStage" = sc."fromStage"
FROM (
  SELECT DISTINCT ON ("ventureId") "ventureId", "fromStage"
  FROM "StageChange"
  WHERE "toStage" = 'PASSED'
  ORDER BY "ventureId", "changedAt" DESC
) sc
WHERE v.id = sc."ventureId" AND v."currentStage" = 'PASSED';

-- Capital Transfer is retired. Deals sitting there go back to Due Diligence (payments are
-- now ticked off in Final Investment), logged in stage history as a system move.
WITH moved AS (
  UPDATE "Venture"
  SET "currentStage" = 'DUE_DILIGENCE', "stageEnteredAt" = now()
  WHERE "currentStage" = 'CAPITAL_TRANSFER'
  RETURNING id
)
INSERT INTO "StageChange" (id, "ventureId", "fromStage", "toStage", note, "changedById", "changedAt")
SELECT gen_random_uuid()::text, id, 'CAPITAL_TRANSFER', 'DUE_DILIGENCE',
       'Automatic: the "Capital Transfer" stage was retired; record payments in Final Investment', NULL, now()
FROM moved;
