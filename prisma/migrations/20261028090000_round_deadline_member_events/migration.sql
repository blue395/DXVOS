-- CreateEnum
CREATE TYPE "MemberEventKind" AS ENUM ('PITCH_SESSION', 'COMMUNITY');

-- AlterTable
ALTER TABLE "MemberRound" ADD COLUMN     "votingClosesAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MemberEvent" (
    "id" TEXT NOT NULL,
    "kind" "MemberEventKind" NOT NULL DEFAULT 'PITCH_SESSION',
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "lumaUrl" TEXT,
    "details" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberEvent_startsAt_idx" ON "MemberEvent"("startsAt");

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEvent" ADD CONSTRAINT "MemberEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Supabase Data API exposure: no access except through the app.
ALTER TABLE "MemberEvent" ENABLE ROW LEVEL SECURITY;
