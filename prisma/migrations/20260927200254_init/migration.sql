-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('FOUNDER_DECK', 'ELIGIBILITY_SCREENING', 'ADD_TO_PIPELINE', 'INTERNAL_REVIEW', 'PITCH_SELECTION', 'PITCH_OUTCOME', 'INVESTMENT_VOTES', 'DUE_DILIGENCE', 'CAPITAL_TRANSFER', 'INVESTMENT', 'PASSED');

-- CreateEnum
CREATE TYPE "PassReason" AS ENUM ('INSUFFICIENT_INTEREST', 'DD_FLAG', 'VALUATION_GAP', 'FOUNDER_WITHDREW', 'INELIGIBLE', 'OTHER');

-- CreateEnum
CREATE TYPE "Gate" AS ENUM ('ELIGIBILITY', 'PITCH_SELECTION', 'PITCH_OUTCOME', 'INVESTMENT_VOTES', 'DUE_DILIGENCE', 'PASSED');

-- CreateEnum
CREATE TYPE "CommsStatus" AS ENUM ('NOT_YET_SENT', 'SENT', 'FOUNDER_ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venture" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founderNames" TEXT,
    "founderEmail" TEXT,
    "website" TEXT,
    "sector" TEXT,
    "companyStage" TEXT,
    "raiseAmountGbp" INTEGER,
    "description" TEXT,
    "deckUrl" TEXT,
    "driveFolderUrl" TEXT,
    "currentStage" "Stage" NOT NULL DEFAULT 'FOUNDER_DECK',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passReason" "PassReason",
    "passNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Venture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageChange" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "fromStage" "Stage",
    "toStage" "Stage" NOT NULL,
    "passReason" "PassReason",
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoVersion" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "docUrl" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DDItem" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DDItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSelectionVote" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "angelName" TEXT NOT NULL,
    "angelId" TEXT,
    "interested" BOOLEAN NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreSelectionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentVote" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "angelName" TEXT NOT NULL,
    "angelId" TEXT,
    "interested" BOOLEAN NOT NULL,
    "maxTicketGbp" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderComm" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "gate" "Gate" NOT NULL,
    "decision" TEXT NOT NULL,
    "status" "CommsStatus" NOT NULL DEFAULT 'NOT_YET_SENT',
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderComm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Venture_currentStage_idx" ON "Venture"("currentStage");

-- CreateIndex
CREATE INDEX "StageChange_ventureId_changedAt_idx" ON "StageChange"("ventureId", "changedAt");

-- CreateIndex
CREATE INDEX "StageChange_changedAt_idx" ON "StageChange"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemoVersion_ventureId_version_key" ON "MemoVersion"("ventureId", "version");

-- CreateIndex
CREATE INDEX "DDItem_ventureId_idx" ON "DDItem"("ventureId");

-- CreateIndex
CREATE INDEX "PreSelectionVote_ventureId_createdAt_idx" ON "PreSelectionVote"("ventureId", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentVote_ventureId_createdAt_idx" ON "InvestmentVote"("ventureId", "createdAt");

-- CreateIndex
CREATE INDEX "FounderComm_status_idx" ON "FounderComm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FounderComm_ventureId_gate_key" ON "FounderComm"("ventureId", "gate");

-- AddForeignKey
ALTER TABLE "Venture" ADD CONSTRAINT "Venture_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DDItem" ADD CONSTRAINT "DDItem_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSelectionVote" ADD CONSTRAINT "PreSelectionVote_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSelectionVote" ADD CONSTRAINT "PreSelectionVote_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentVote" ADD CONSTRAINT "InvestmentVote_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentVote" ADD CONSTRAINT "InvestmentVote_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderComm" ADD CONSTRAINT "FounderComm_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderComm" ADD CONSTRAINT "FounderComm_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
