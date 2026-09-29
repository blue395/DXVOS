-- Deal room (2026-10-05): sharing deals with angels, per-document visibility by stage, share log.
-- Additive only: nothing is shared until an admin shares it.

-- CreateEnum
CREATE TYPE "AngelDocPhase" AS ENUM ('POST_PITCH', 'COMMITMENTS');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "angelVisibleFrom" "AngelDocPhase";

-- AlterTable
ALTER TABLE "Venture" ADD COLUMN     "angelSummary" TEXT,
ADD COLUMN     "sharedWithAngelsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DealShareLog" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealShareLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealShareLog_ventureId_createdAt_idx" ON "DealShareLog"("ventureId", "createdAt");

-- AddForeignKey
ALTER TABLE "DealShareLog" ADD CONSTRAINT "DealShareLog_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShareLog" ADD CONSTRAINT "DealShareLog_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing reads this table through it.
ALTER TABLE "DealShareLog" ENABLE ROW LEVEL SECURITY;
