-- Shareable member sign-up links (Blue, 2026-11-05): MemberJoinLink + MemberJoinRequest.
-- Anyone with a link asks to join, confirms their email, a partner approves, then the normal invite.

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('UNCONFIRMED', 'PENDING', 'APPROVED', 'DECLINED', 'HAS_LOGIN');

-- CreateTable
CREATE TABLE "MemberJoinLink" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberJoinLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberJoinRequest" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "confirmTokenHash" TEXT,
    "confirmExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "angelId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberJoinRequest_confirmTokenHash_key" ON "MemberJoinRequest"("confirmTokenHash");

-- CreateIndex
CREATE INDEX "MemberJoinRequest_linkId_status_idx" ON "MemberJoinRequest"("linkId", "status");

-- CreateIndex
CREATE INDEX "MemberJoinRequest_status_createdAt_idx" ON "MemberJoinRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MemberJoinRequest_email_createdAt_idx" ON "MemberJoinRequest"("email", "createdAt");

-- CreateIndex
CREATE INDEX "MemberJoinRequest_ipHash_createdAt_idx" ON "MemberJoinRequest"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberJoinLink" ADD CONSTRAINT "MemberJoinLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberJoinRequest" ADD CONSTRAINT "MemberJoinRequest_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MemberJoinLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberJoinRequest" ADD CONSTRAINT "MemberJoinRequest_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberJoinRequest" ADD CONSTRAINT "MemberJoinRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing is readable through it.
ALTER TABLE "MemberJoinLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberJoinRequest" ENABLE ROW LEVEL SECURITY;
