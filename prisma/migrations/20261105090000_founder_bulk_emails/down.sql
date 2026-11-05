-- Rollback for 20261105090000_founder_bulk_emails (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261105090000_founder_bulk_emails).
-- The BULK value stays in FounderEmailKind (Postgres can't drop an enum value); rows using it are removed first.
DELETE FROM "FounderEmail" WHERE "kind" = 'BULK';
ALTER TABLE "FounderEmail" DROP CONSTRAINT IF EXISTS "FounderEmail_bulkEmailId_fkey";
ALTER TABLE "FounderEmail" DROP COLUMN IF EXISTS "bulkEmailId";
ALTER TABLE "MemberEmailAttachment" DROP CONSTRAINT IF EXISTS "MemberEmailAttachment_founderBulkEmailId_fkey";
ALTER TABLE "MemberEmailAttachment" DROP COLUMN IF EXISTS "founderBulkEmailId";
DROP TABLE IF EXISTS "FounderBulkRecipient";
DROP TABLE IF EXISTS "FounderBulkEmail";
