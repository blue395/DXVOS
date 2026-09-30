-- CreateEnum
CREATE TYPE "HoldingStatus" AS ENUM ('ACTIVE', 'EXITED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "InvestmentInstrument" AS ENUM ('EQUITY', 'ASA', 'CLN', 'SAFE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxReliefScheme" AS ENUM ('SEIS', 'EIS', 'NONE');

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "finalInvestmentId" TEXT,
    "companyName" TEXT,
    "description" TEXT,
    "sector" TEXT,
    "investedVia" TEXT,
    "round" TEXT,
    "investedOn" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "amountMinor" INTEGER,
    "instrument" "InvestmentInstrument",
    "valuationAtInvestment" INTEGER,
    "sharePrice" DOUBLE PRECISION,
    "shares" INTEGER,
    "currentValueMinor" INTEGER,
    "currentValueOn" TIMESTAMP(3),
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "proceedsMinor" INTEGER,
    "taxScheme" "TaxReliefScheme",
    "taxCertificateReceived" BOOLEAN NOT NULL DEFAULT false,
    "shareCertificateReceived" BOOLEAN NOT NULL DEFAULT false,
    "keyDate" TIMESTAMP(3),
    "keyDateNote" TEXT,
    "source" TEXT,
    "rationale" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioHolding_finalInvestmentId_key" ON "PortfolioHolding"("finalInvestmentId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_angelId_archivedAt_idx" ON "PortfolioHolding"("angelId", "archivedAt");

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_finalInvestmentId_fkey" FOREIGN KEY ("finalInvestmentId") REFERENCES "FinalInvestment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API exposure: the new table is private (the app connects as the owner).
ALTER TABLE "PortfolioHolding" ENABLE ROW LEVEL SECURITY;
