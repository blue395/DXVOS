-- Angel Foundations course (Blue, 2026-11-27): learner logins (Role LEARNER), course progress,
-- consents with their exact wording, and course opt-ins as join requests (linkId now optional).
-- CreateEnum
CREATE TYPE "LearnerDescribesAs" AS ENUM ('HIGH_NET_WORTH', 'SOPHISTICATED', 'ACTIVE_ANGEL', 'TRAINING');

-- CreateEnum
CREATE TYPE "CourseConsentKind" AS ENUM ('PRIVACY_NOTICE', 'AGE', 'SYNDICATE_CONTACT');

-- AlterEnum
ALTER TYPE "JoinRequestStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LEARNER';

-- AlterTable
ALTER TABLE "MemberJoinRequest" ADD COLUMN     "learnerId" TEXT,
ALTER COLUMN "linkId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CourseLearner" (
    "userId" TEXT NOT NULL,
    "describesAs" "LearnerDescribesAs",
    "describedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLearner_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CourseProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lesson" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3),
    "answers" JSONB NOT NULL DEFAULT '{}',
    "notes" JSONB NOT NULL DEFAULT '{}',
    "correct" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CourseConsentKind" NOT NULL,
    "given" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "wording" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLearner_createdAt_idx" ON "CourseLearner"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgress_userId_lesson_key" ON "CourseProgress"("userId", "lesson");

-- CreateIndex
CREATE INDEX "CourseConsent_userId_kind_createdAt_idx" ON "CourseConsent"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberJoinRequest" ADD CONSTRAINT "MemberJoinRequest_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLearner" ADD CONSTRAINT "CourseLearner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CourseLearner"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseConsent" ADD CONSTRAINT "CourseConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CourseLearner"("userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase Data API: nobody reads these through it.
ALTER TABLE "CourseLearner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseConsent" ENABLE ROW LEVEL SECURITY;
