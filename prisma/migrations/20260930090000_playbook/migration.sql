-- Playbook (2026-09-30): versioned eligibility and assessment criteria, lessons, and AI
-- lesson suggestion jobs. Additive only.

-- CreateEnum
CREATE TYPE "PlaybookKind" AS ENUM ('ELIGIBILITY', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "LessonScope" AS ENUM ('GENERAL', 'ELIGIBILITY', 'ASSESSMENT', 'DUE_DILIGENCE', 'PORTFOLIO');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LessonSource" AS ENUM ('HUMAN', 'AI');

-- CreateEnum
CREATE TYPE "LessonTrigger" AS ENUM ('DECLINED', 'MEMO_REVIEWED', 'ELIGIBILITY_DECIDED');

-- AlterTable
ALTER TABLE "DeckAnalysis" ADD COLUMN     "aiContext" JSONB;

-- CreateTable
CREATE TABLE "PlaybookVersion" (
    "id" TEXT NOT NULL,
    "kind" "PlaybookKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scope" "LessonScope" NOT NULL DEFAULT 'GENERAL',
    "status" "LessonStatus" NOT NULL DEFAULT 'APPROVED',
    "source" "LessonSource" NOT NULL DEFAULT 'HUMAN',
    "origin" TEXT,
    "ventureId" TEXT,
    "jobId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonJob" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "trigger" "LessonTrigger" NOT NULL,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "context" JSONB NOT NULL,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookVersion_kind_version_key" ON "PlaybookVersion"("kind", "version");

-- CreateIndex
CREATE INDEX "Lesson_status_scope_idx" ON "Lesson"("status", "scope");

-- CreateIndex
CREATE INDEX "LessonJob_ventureId_createdAt_idx" ON "LessonJob"("ventureId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlaybookVersion" ADD CONSTRAINT "PlaybookVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LessonJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonJob" ADD CONSTRAINT "LessonJob_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonJob" ADD CONSTRAINT "LessonJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Row Level Security (no policies): keep the new tables out of Supabase's Data API.
ALTER TABLE "PlaybookVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonJob" ENABLE ROW LEVEL SECURITY;
