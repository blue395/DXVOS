-- Angel portal (2026-10-04): angel logins, invites, approved compliance wording, onboarding,
-- self-signed certifications, angel activity log. Additive only.

-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('INVITE', 'RESET');

-- CreateEnum
CREATE TYPE "ComplianceTextKind" AS ENUM ('HNW_STATEMENT', 'SOPHISTICATED_STATEMENT', 'MEMBER_TERMS');

-- CreateEnum
CREATE TYPE "ComplianceTextStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ANGEL';

-- AlterTable
ALTER TABLE "Angel" ADD COLUMN     "experience" TEXT,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "profileConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "restrictedDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersionId" TEXT,
ADD COLUMN     "ticketRange" TEXT;

-- AlterTable
ALTER TABLE "AngelCertification" ADD COLUMN     "complianceTextId" TEXT,
ADD COLUMN     "criteria" TEXT[],
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "signatureName" TEXT,
ADD COLUMN     "signedByAngel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "angelId" TEXT,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "lastSignInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AngelInvite" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL DEFAULT 'INVITE',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngelInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceText" (
    "id" TEXT NOT NULL,
    "kind" "ComplianceTextKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "criteria" TEXT[],
    "status" "ComplianceTextStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngelEvent" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AngelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AngelInvite_tokenHash_key" ON "AngelInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AngelInvite_angelId_createdAt_idx" ON "AngelInvite"("angelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceText_kind_version_key" ON "ComplianceText"("kind", "version");

-- CreateIndex
CREATE INDEX "AngelEvent_angelId_createdAt_idx" ON "AngelEvent"("angelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_angelId_key" ON "User"("angelId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelCertification" ADD CONSTRAINT "AngelCertification_complianceTextId_fkey" FOREIGN KEY ("complianceTextId") REFERENCES "ComplianceText"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelInvite" ADD CONSTRAINT "AngelInvite_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelInvite" ADD CONSTRAINT "AngelInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceText" ADD CONSTRAINT "ComplianceText_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceText" ADD CONSTRAINT "ComplianceText_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngelEvent" ADD CONSTRAINT "AngelEvent_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing reads these tables through it.
ALTER TABLE "AngelInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceText" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AngelEvent" ENABLE ROW LEVEL SECURITY;
