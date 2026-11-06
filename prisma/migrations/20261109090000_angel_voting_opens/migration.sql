-- Members' pitch-selection voting opens only when a partner presses "Open angel votes" after the
-- live presentation (Blue, 2026-11-06). Only votes cast from then count; earlier ones (e.g. Round 4
-- votes cast before its presentation) stay on record but no longer count.
ALTER TABLE "MemberRound" ADD COLUMN "votingOpenedAt" TIMESTAMP(3);
