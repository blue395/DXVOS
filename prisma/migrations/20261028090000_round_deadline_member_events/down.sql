-- Rollback for 20261028090000_round_deadline_member_events (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261028090000_round_deadline_member_events).
DROP TABLE IF EXISTS "MemberEvent";
DROP TYPE IF EXISTS "MemberEventKind";
ALTER TABLE "MemberRound" DROP COLUMN IF EXISTS "votingClosesAt";
