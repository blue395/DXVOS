-- Rollback for 20261107090000_member_join_links (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261107090000_member_join_links).
DROP TABLE IF EXISTS "MemberJoinRequest";
DROP TABLE IF EXISTS "MemberJoinLink";
DROP TYPE IF EXISTS "JoinRequestStatus";
