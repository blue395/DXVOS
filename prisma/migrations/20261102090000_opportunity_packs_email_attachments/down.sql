-- Rollback for 20261102090000_opportunity_packs_email_attachments (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261102090000_opportunity_packs_email_attachments).
DROP TABLE IF EXISTS "MemberEmailAttachment";
DROP TABLE IF EXISTS "VentureLogo";
DROP TABLE IF EXISTS "OpportunityPack";
