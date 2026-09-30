-- AlterTable
ALTER TABLE "Venture" ADD COLUMN     "oneLiner" TEXT;

-- Backfill from what the team already wrote for members (the first sentence of the
-- members' summary). Never from the AI screen or the internal description.
UPDATE "Venture"
SET "oneLiner" = left(COALESCE(substring(btrim("angelSummary") from '^.*?[.!?](?=\s|$)'), btrim("angelSummary")), 200)
WHERE "angelSummary" IS NOT NULL AND btrim("angelSummary") <> '';
