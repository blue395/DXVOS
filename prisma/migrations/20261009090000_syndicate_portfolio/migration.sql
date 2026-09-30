-- CreateTable
CREATE TABLE "SyndicateHolding" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT,
    "companyName" TEXT,
    "sector" TEXT,
    "round" INTEGER,
    "companyStage" TEXT,
    "investedOn" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "amountMinor" INTEGER,
    "angelsCount" INTEGER,
    "description" TEXT,
    "instrument" "InvestmentInstrument",
    "valuationAtInvestment" INTEGER,
    "sharePrice" DOUBLE PRECISION,
    "currentValueMinor" INTEGER,
    "currentValueOn" TIMESTAMP(3),
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "proceedsMinor" INTEGER,
    "taxScheme" "TaxReliefScheme",
    "diversityThemes" TEXT[],
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SyndicateHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyndicateHolding_ventureId_key" ON "SyndicateHolding"("ventureId");

-- CreateIndex
CREATE INDEX "SyndicateHolding_archivedAt_idx" ON "SyndicateHolding"("archivedAt");

-- AddForeignKey
ALTER TABLE "SyndicateHolding" ADD CONSTRAINT "SyndicateHolding_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateHolding" ADD CONSTRAINT "SyndicateHolding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicateHolding" ADD CONSTRAINT "SyndicateHolding_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Data API exposure: the new table is private (the app connects as the owner).
ALTER TABLE "SyndicateHolding" ENABLE ROW LEVEL SECURITY;
