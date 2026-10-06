-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('UPLOADING', 'COMPLETE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FounderEmailKind" AS ENUM ('ACKNOWLEDGEMENT', 'DECISION');

-- CreateTable
CREATE TABLE "FounderSubmission" (
    "id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'UPLOADING',
    "completionTokenHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "founderNames" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "sector" TEXT,
    "companyStage" TEXT,
    "raiseAmountGbp" INTEGER,
    "pitch" TEXT NOT NULL,
    "heardFrom" TEXT,
    "diversityThemes" TEXT[],
    "privacyConsentAt" TIMESTAMP(3) NOT NULL,
    "diversityConsentAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "analysisId" TEXT,
    "ventureId" TEXT,
    "resubmission" BOOLEAN NOT NULL DEFAULT false,
    "previousVentureId" TEXT,
    "digestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FounderSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderEmail" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "commId" TEXT,
    "kind" "FounderEmailKind" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FounderEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FounderSubmission_analysisId_key" ON "FounderSubmission"("analysisId");

-- CreateIndex
CREATE INDEX "FounderSubmission_createdAt_idx" ON "FounderSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "FounderSubmission_ipHash_createdAt_idx" ON "FounderSubmission"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "FounderSubmission_email_createdAt_idx" ON "FounderSubmission"("email", "createdAt");

-- CreateIndex
CREATE INDEX "FounderEmail_ventureId_createdAt_idx" ON "FounderEmail"("ventureId", "createdAt");

-- AddForeignKey
ALTER TABLE "FounderSubmission" ADD CONSTRAINT "FounderSubmission_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderEmail" ADD CONSTRAINT "FounderEmail_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderEmail" ADD CONSTRAINT "FounderEmail_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Data API exposure: keep the tables private to the server.
ALTER TABLE "FounderSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FounderEmail" ENABLE ROW LEVEL SECURITY;

-- "DXV website": files founder submissions. Role SYSTEM and revoked, with a password nobody
-- knows (the sign-in page's dummy hash), so it can never sign in.
INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "disabledAt")
VALUES ('system-website', 'website@system.invalid', 'DXV website', '$2b$12$3aeQTGIIJcozlbgapidaFuazz8rHyj/eSW0rrcQUgPfUP614nYA4a', 'SYSTEM', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Founder email templates (Blue, 2026-10-06), edited on Deals → Website submissions.
INSERT INTO "EmailTemplate" ("id", "key", "name", "subject", "body", "updatedAt") VALUES
  ('tmpl_founder_ack', 'founder-ack', 'Founder: application received', 'We''ve received {{company}}''s application', 'Hi {{first_name}},

Thank you for submitting {{company}} to Diversity X Ventures. We''ve received your deck and the team will review it against our investment criteria.

We back Underestimated Founders® building Impact Ventures at pre-seed and seed stage. We''ll be in touch with an update once we''ve reviewed your application.

In the meantime, if anything changes or you have a question, just reply to this email.

Best wishes,

Blué O''Connor
Co-Founder
Diversity X Ventures', CURRENT_TIMESTAMP),
  ('tmpl_founder_progress', 'founder-progress', 'Founder: moving forward', '{{company}} and DXV: next steps', 'Hi {{first_name}},

Thank you again for sharing {{company}} with Diversity X Ventures. Good news: we''d like to take things to the next step ({{next_step}}).

We''ll be in touch shortly with what happens next and anything we need from you.

Best wishes,

Blué O''Connor
Co-Founder
Diversity X Ventures', CURRENT_TIMESTAMP),
  ('tmpl_founder_decline', 'founder-decline', 'Founder: not taking forward', '{{company}} and DXV: our decision', 'Hi {{first_name}},

Thank you for sharing {{company}} with Diversity X Ventures, and for the time you put into your application.

After careful consideration, we''ve decided not to take {{company}} forward at this stage. This isn''t always a reflection of the strength of the business: we can only back a small number of companies that fit our criteria and timing.

We keep every application on file, and we''d be glad to hear how things progress.

Wishing you every success,

Blué O''Connor
Co-Founder
Diversity X Ventures', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
