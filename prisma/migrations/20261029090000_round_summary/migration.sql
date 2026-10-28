-- CreateTable
CREATE TABLE "RoundSummary" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "context" JSONB NOT NULL,
    "aiOutput" JSONB,
    "content" JSONB,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "RoundSummary_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "RoundSummary_createdAt_idx" ON "RoundSummary"("createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "RoundSummary_round_number_key" ON "RoundSummary"("round", "number");
-- AddForeignKey
ALTER TABLE "RoundSummary" ADD CONSTRAINT "RoundSummary_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RoundSummary" ADD CONSTRAINT "RoundSummary_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Data API exposure: no access except through the app.
ALTER TABLE "RoundSummary" ENABLE ROW LEVEL SECURITY;
