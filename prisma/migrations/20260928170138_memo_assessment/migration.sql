-- CreateEnum
CREATE TYPE "MemoVersionKind" AS ENUM ('DRIVE_LINK', 'REVIEWED_MEMO');

-- AlterTable
ALTER TABLE "MemoVersion" ADD COLUMN     "content" JSONB,
ADD COLUMN     "kind" "MemoVersionKind" NOT NULL DEFAULT 'DRIVE_LINK',
ADD COLUMN     "sourceAnalysisId" TEXT,
ALTER COLUMN "docUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MemoAnalysis" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "context" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MemoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoDraft" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MemoDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoScoreChange" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "fromScore" INTEGER NOT NULL,
    "toScore" INTEGER NOT NULL,
    "justification" TEXT,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoScoreChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoAnalysis_ventureId_number_key" ON "MemoAnalysis"("ventureId", "number");

-- CreateIndex
CREATE INDEX "MemoDraft_ventureId_archivedAt_idx" ON "MemoDraft"("ventureId", "archivedAt");

-- CreateIndex
CREATE INDEX "MemoScoreChange_draftId_changedAt_idx" ON "MemoScoreChange"("draftId", "changedAt");

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_sourceAnalysisId_fkey" FOREIGN KEY ("sourceAnalysisId") REFERENCES "MemoAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoAnalysis" ADD CONSTRAINT "MemoAnalysis_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoAnalysis" ADD CONSTRAINT "MemoAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDraft" ADD CONSTRAINT "MemoDraft_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDraft" ADD CONSTRAINT "MemoDraft_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "MemoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDraft" ADD CONSTRAINT "MemoDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDraft" ADD CONSTRAINT "MemoDraft_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoScoreChange" ADD CONSTRAINT "MemoScoreChange_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "MemoDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoScoreChange" ADD CONSTRAINT "MemoScoreChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (no policies): keep these out of Supabase's Data API.
ALTER TABLE "MemoAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoScoreChange" ENABLE ROW LEVEL SECURITY;
