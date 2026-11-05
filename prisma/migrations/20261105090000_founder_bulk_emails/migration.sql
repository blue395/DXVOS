-- Partners' bulk emails to founders (Blue, 2026-11-05): FounderBulkEmail + FounderBulkRecipient,
-- copies kept as FounderEmail (kind BULK), attachments reuse MemberEmailAttachment.

-- AlterEnum
ALTER TYPE "FounderEmailKind" ADD VALUE 'BULK';

-- AlterTable
ALTER TABLE "FounderEmail" ADD COLUMN     "bulkEmailId" TEXT;

-- AlterTable
ALTER TABLE "MemberEmailAttachment" ADD COLUMN     "founderBulkEmailId" TEXT;

-- CreateTable
CREATE TABLE "FounderBulkEmail" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FounderBulkEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderBulkRecipient" (
    "id" TEXT NOT NULL,
    "bulkEmailId" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MemberEmailStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "FounderBulkRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FounderBulkRecipient_bulkEmailId_status_idx" ON "FounderBulkRecipient"("bulkEmailId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FounderBulkRecipient_bulkEmailId_ventureId_key" ON "FounderBulkRecipient"("bulkEmailId", "ventureId");

-- AddForeignKey
ALTER TABLE "MemberEmailAttachment" ADD CONSTRAINT "MemberEmailAttachment_founderBulkEmailId_fkey" FOREIGN KEY ("founderBulkEmailId") REFERENCES "FounderBulkEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderEmail" ADD CONSTRAINT "FounderEmail_bulkEmailId_fkey" FOREIGN KEY ("bulkEmailId") REFERENCES "FounderBulkEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderBulkEmail" ADD CONSTRAINT "FounderBulkEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderBulkRecipient" ADD CONSTRAINT "FounderBulkRecipient_bulkEmailId_fkey" FOREIGN KEY ("bulkEmailId") REFERENCES "FounderBulkEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderBulkRecipient" ADD CONSTRAINT "FounderBulkRecipient_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing is readable through it.
ALTER TABLE "FounderBulkEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FounderBulkRecipient" ENABLE ROW LEVEL SECURITY;
