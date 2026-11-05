-- Rollback for 20261108090000_instant_join_links (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261108090000_instant_join_links).
ALTER TABLE "MemberJoinLink" DROP COLUMN IF EXISTS "instant";
