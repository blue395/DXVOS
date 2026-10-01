-- CreateEnum
CREATE TYPE "MemberEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Angel" ADD COLUMN     "emailOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEmail" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEmailRecipient" (
    "id" TEXT NOT NULL,
    "memberEmailId" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MemberEmailStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "invited" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MemberEmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "MemberEmailRecipient_memberEmailId_status_idx" ON "MemberEmailRecipient"("memberEmailId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MemberEmailRecipient_memberEmailId_angelId_key" ON "MemberEmailRecipient"("memberEmailId", "angelId");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmail" ADD CONSTRAINT "MemberEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmailRecipient" ADD CONSTRAINT "MemberEmailRecipient_memberEmailId_fkey" FOREIGN KEY ("memberEmailId") REFERENCES "MemberEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmailRecipient" ADD CONSTRAINT "MemberEmailRecipient_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase Data API exposure: keep the tables private to the server.
ALTER TABLE "EmailTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberEmailRecipient" ENABLE ROW LEVEL SECURITY;

-- Starting templates (Blue, 2026-10-01): the welcome email new angels get with their invite,
-- and a launch announcement for existing angels. Both are edited in DXV OS (Angels → Email angels).
INSERT INTO "EmailTemplate" ("id", "key", "name", "subject", "body", "updatedAt") VALUES
  ('tmpl_welcome', 'welcome', 'Welcome (new angels)', 'Welcome to Diversity X Ventures', 'Hi {{first_name}},

Welcome to Diversity X Ventures.

We''re a UK angel syndicate backing Underestimated Founders® building Impact Ventures at pre-seed and seed stage.

Two quick things to get you properly set up:

First, we''ve just launched our new [DXV Deal Platform for Angels]({{platform_link}}). It''s brand new, so please bear with us as we iron out a few early bugs, and do tell us if anything needs fixing or improving. Setting up your profile takes less than two minutes, and gives you access to our latest deals.

Second, [join our syndicate WhatsApp group](PASTE-WHATSAPP-LINK-HERE). It''s where we share events, announce deal rounds, take questions across our 50+ angels

Glad to have you with us.

Blué O''Connor
Co-Founder
Diversity X Ventures', CURRENT_TIMESTAMP),
  ('tmpl_platform_launch', NULL, 'Platform launch (existing angels)', 'The new DXV Deal Platform: set up your access', 'Hi {{first_name}},

We''ve just launched the DXV Deal Platform for Angels, and from our next round it''s where we''ll share deals with members: pitch decks, our investment memos, and your votes, all in one place.

[Set up your access here]({{platform_link}}). It takes less than two minutes: confirm your details and complete your investor statement, and you''ll see deals as soon as they open to members.

It''s brand new, so please bear with us as we iron out a few early bugs, and do tell us if anything needs fixing or improving. Over time we''ll also use it for event invitations and other syndicate news.

Thanks for being part of DXV.

Blué O''Connor
Co-Founder
Diversity X Ventures', CURRENT_TIMESTAMP);
