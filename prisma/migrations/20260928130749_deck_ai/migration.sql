-- CreateEnum
CREATE TYPE "DeckAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "EligibilityDecision" AS ENUM ('PROCEED', 'DECLINE', 'NEED_MORE_INFO');

-- CreateTable
CREATE TABLE "DeckAnalysis" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "extracted" JSONB,
    "screen" JSONB,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeckAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityReview" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "analysisId" TEXT,
    "decision" "EligibilityDecision" NOT NULL,
    "passReason" "PassReason",
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeckAnalysis_ventureId_createdAt_idx" ON "DeckAnalysis"("ventureId", "createdAt");

-- CreateIndex
CREATE INDEX "EligibilityReview_ventureId_decidedAt_idx" ON "EligibilityReview"("ventureId", "decidedAt");

-- AddForeignKey
ALTER TABLE "DeckAnalysis" ADD CONSTRAINT "DeckAnalysis_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckAnalysis" ADD CONSTRAINT "DeckAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityReview" ADD CONSTRAINT "EligibilityReview_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityReview" ADD CONSTRAINT "EligibilityReview_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DeckAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityReview" ADD CONSTRAINT "EligibilityReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (no policies): keep these out of Supabase's Data API.
ALTER TABLE "DeckAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EligibilityReview" ENABLE ROW LEVEL SECURITY;

-- Private Supabase Storage bucket for deck copies: PDFs only, max 20 MB
-- (Claude's 32 MB request limit, less base64 overhead). Only exists on Supabase,
-- so skipped on plain local Postgres. No storage policies: only the server's
-- secret key can read or write, and the browser uploads via one-time signed URLs.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('decks', 'decks', false, 20971520, ARRAY['application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Don't block the deploy; docs/DEPLOY.md explains creating the bucket by hand.
  RAISE NOTICE 'Could not create storage bucket "decks": create it in the Supabase dashboard';
END $$;
