-- Enable Row Level Security on every table, with no policies.
--
-- Why: Supabase auto-exposes tables in the `public` schema through its Data API
-- (PostgREST) to the `anon` and `authenticated` roles. With RLS on and no policies,
-- those roles can read/write nothing. The app connects as the table owner via
-- Prisma, which bypasses RLS, so the app itself is unaffected.
--
-- Harmless on plain Postgres (e.g. local dev). Every future table needs the same.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Venture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StageChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DDItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PreSelectionVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvestmentVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FounderComm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
