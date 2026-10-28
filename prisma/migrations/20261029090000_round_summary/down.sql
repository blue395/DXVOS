-- Rollback for 20261029090000_round_summary (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261029090000_round_summary).
DROP TABLE IF EXISTS "RoundSummary";
