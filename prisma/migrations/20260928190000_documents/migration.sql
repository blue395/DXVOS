-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('DECK', 'MEMO', 'DUE_DILIGENCE', 'LEGAL', 'FINANCIALS', 'OTHER');

-- AlterEnum
ALTER TYPE "MemoVersionKind" ADD VALUE 'UPLOADED_FILE';

-- AlterTable
ALTER TABLE "MemoVersion" ADD COLUMN     "documentId" TEXT;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "bucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "ddItemId" TEXT,
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_ventureId_category_idx" ON "Document"("ventureId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Document_bucket_storagePath_key" ON "Document"("bucket", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "MemoVersion_documentId_key" ON "MemoVersion"("documentId");

-- AddForeignKey
ALTER TABLE "MemoVersion" ADD CONSTRAINT "MemoVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ddItemId_fkey" FOREIGN KEY ("ddItemId") REFERENCES "DDItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row Level Security (no policies): keep documents out of Supabase's Data API.
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

-- Private Storage bucket for deal documents: PDF, Word and Excel, max 50 MB.
-- Only exists on Supabase, so skipped on plain local Postgres. No storage policies:
-- only the server's secret key can read or write; browsers upload via one-time signed URLs.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('documents', 'documents', false, 52428800, ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ])
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not create storage bucket "documents": create it in the Supabase dashboard';
END $$;

-- Backfill: every deck already uploaded for the AI eligibility screen becomes a
-- Deck document (one per stored file), so existing decks appear under Documents.
INSERT INTO "Document" (id, "ventureId", category, bucket, "storagePath", "fileName", "mimeType", "sizeBytes", "uploadedById", "createdAt", "uploadedAt")
SELECT DISTINCT ON (d."storagePath")
  gen_random_uuid()::text, d."ventureId", 'DECK', 'decks', d."storagePath", d."fileName", 'application/pdf', d."fileSize",
  d."createdById", d."createdAt", d."createdAt"
FROM "DeckAnalysis" d
WHERE d."ventureId" IS NOT NULL AND d.status <> 'PENDING'
ORDER BY d."storagePath", d."createdAt"
ON CONFLICT (bucket, "storagePath") DO NOTHING;
