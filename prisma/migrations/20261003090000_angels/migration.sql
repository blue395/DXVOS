-- Angels (2026-10-03): angel records, certification history, notes, name aliases linking
-- older free-text votes. Additive only.

-- CreateEnum
CREATE TYPE "AngelStatus" AS ENUM ('PROSPECT', 'MEMBER', 'LAPSED');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('HIGH_NET_WORTH', 'SELF_CERTIFIED_SOPHISTICATED', 'CERTIFIED_SOPHISTICATED');

-- AlterTable
ALTER TABLE "FinalInvestment" ADD COLUMN     "angelId" TEXT;

-- CreateTable
CREATE TABLE "Angel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "location" TEXT,
    "bio" TEXT,
    "status" "AngelStatus" NOT NULL DEFAULT 'PROSPECT',
    "sectors" TEXT[],
    "tags" TEXT[],
    "whatsappGroups" TEXT[],
    "source" TEXT,
    "membershipTier" TEXT,
    "joinedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Angel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngelCertification" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "type" "CertificationType" NOT NULL,
    "signedOn" TIMESTAMP(3) NOT NULL,
    "expiresOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "bucket" TEXT,
    "storagePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngelCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngelNote" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngelNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngelAlias" (
    "id" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngelAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Angel_email_key" ON "Angel"("email");

-- CreateIndex
CREATE INDEX "Angel_status_idx" ON "Angel"("status");

-- CreateIndex
CREATE INDEX "AngelCertification_angelId_signedOn_idx" ON "AngelCertification"("angelId", "signedOn");

-- CreateIndex
CREATE INDEX "AngelNote_angelId_createdAt_idx" ON "AngelNote"("angelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AngelAlias_normalized_key" ON "AngelAlias"("normalized");

-- The reserved vote angelId columns were never written; clear any stray value so the
-- new foreign keys can't fail.
UPDATE "PreSelectionVote" SET "angelId" = NULL WHERE "angelId" IS NOT NULL;
UPDATE "InvestmentVote" SET "angelId" = NULL WHERE "angelId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "PreSelectionVote" ADD CONSTRAINT "PreSelectionVote_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentVote" ADD CONSTRAINT "InvestmentVote_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalInvestment" ADD CONSTRAINT "FinalInvestment_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Angel" ADD CONSTRAINT "Angel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Angel" ADD CONSTRAINT "Angel_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelCertification" ADD CONSTRAINT "AngelCertification_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelCertification" ADD CONSTRAINT "AngelCertification_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelNote" ADD CONSTRAINT "AngelNote_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelNote" ADD CONSTRAINT "AngelNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelAlias" ADD CONSTRAINT "AngelAlias_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelAlias" ADD CONSTRAINT "AngelAlias_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing reads these tables through it.
ALTER TABLE "Angel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AngelCertification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AngelNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AngelAlias" ENABLE ROW LEVEL SECURITY;
