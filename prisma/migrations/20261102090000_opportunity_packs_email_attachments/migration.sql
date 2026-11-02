-- CreateTable
CREATE TABLE "OpportunityPack" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
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
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentureLogo" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentureLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEmailAttachment" (
    "id" TEXT NOT NULL,
    "memberEmailId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "opportunityPackId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberEmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityPack_createdAt_idx" ON "OpportunityPack"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityPack_round_number_key" ON "OpportunityPack"("round", "number");

-- CreateIndex
CREATE INDEX "VentureLogo_ventureId_createdAt_idx" ON "VentureLogo"("ventureId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberEmailAttachment_memberEmailId_idx" ON "MemberEmailAttachment"("memberEmailId");

-- CreateIndex
CREATE INDEX "MemberEmailAttachment_createdById_createdAt_idx" ON "MemberEmailAttachment"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "OpportunityPack" ADD CONSTRAINT "OpportunityPack_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPack" ADD CONSTRAINT "OpportunityPack_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPack" ADD CONSTRAINT "OpportunityPack_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentureLogo" ADD CONSTRAINT "VentureLogo_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentureLogo" ADD CONSTRAINT "VentureLogo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmailAttachment" ADD CONSTRAINT "MemberEmailAttachment_memberEmailId_fkey" FOREIGN KEY ("memberEmailId") REFERENCES "MemberEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmailAttachment" ADD CONSTRAINT "MemberEmailAttachment_opportunityPackId_fkey" FOREIGN KEY ("opportunityPackId") REFERENCES "OpportunityPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmailAttachment" ADD CONSTRAINT "MemberEmailAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supabase Data API exposure: no access except through the app.
ALTER TABLE "OpportunityPack" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VentureLogo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberEmailAttachment" ENABLE ROW LEVEL SECURITY;

-- Private Storage bucket for email attachments: PDF, Word, Excel, PNG and JPEG, max 15 MB.
-- Only exists on Supabase, so skipped on plain local Postgres. No storage policies: only the
-- server's secret key can read or write; browsers upload via one-time signed URLs.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('email-attachments', 'email-attachments', false, 15728640, ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    ])
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not create storage bucket "email-attachments": create it in the Supabase dashboard';
END $$;
