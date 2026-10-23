-- Rollback for 20261025090000_retention_inactivity (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261025090000_retention_inactivity).
ALTER TABLE "Angel" DROP COLUMN IF EXISTS "inactivityWarnedAt";
