-- Simplified pipeline (2026-09-28).
-- Stages are RENAMED IN PLACE, so every existing deal and every stage-history row
-- keeps its meaning under the new name. Nothing is dropped.

-- 1. Stage names
ALTER TYPE "Stage" RENAME VALUE 'FOUNDER_DECK' TO 'SUBMITTED';
ALTER TYPE "Stage" RENAME VALUE 'ELIGIBILITY_SCREENING' TO 'ELIGIBILITY_SCREEN';
ALTER TYPE "Stage" RENAME VALUE 'INTERNAL_REVIEW' TO 'PARTNER_REVIEW';
ALTER TYPE "Stage" RENAME VALUE 'INVESTMENT_VOTES' TO 'INVESTMENT_COMMITMENTS';
ALTER TYPE "Stage" RENAME VALUE 'INVESTMENT' TO 'INVESTMENT_COMPLETE';
ALTER TYPE "Stage" ADD VALUE IF NOT EXISTS 'SEIS_CERTIFICATE' AFTER 'INVESTMENT_COMPLETE';
-- 'ADD_TO_PIPELINE' is retired but kept: Postgres can't drop an enum value safely,
-- and old stage history still refers to it.

-- 2. Decision gates: DXV Partner Review becomes a gate; Investment votes renamed.
ALTER TYPE "Gate" RENAME VALUE 'INVESTMENT_VOTES' TO 'INVESTMENT_COMMITMENTS';
ALTER TYPE "Gate" ADD VALUE IF NOT EXISTS 'PARTNER_REVIEW' AFTER 'ELIGIBILITY';

-- 3. DXV round on each deal
ALTER TABLE "Venture" ADD COLUMN "round" INTEGER;

-- 4. Allow "System" stage moves (no user), for moves made by migrations like this one.
ALTER TABLE "StageChange" ALTER COLUMN "changedById" DROP NOT NULL;

-- 5. Deals sitting at the retired stage move on to DXV Partner Review, and the move
--    is logged in stage history as made by the system.
WITH moved AS (
  UPDATE "Venture"
  SET "currentStage" = 'PARTNER_REVIEW', "stageEnteredAt" = now()
  WHERE "currentStage" = 'ADD_TO_PIPELINE'
  RETURNING id
)
INSERT INTO "StageChange" (id, "ventureId", "fromStage", "toStage", note, "changedById", "changedAt")
SELECT gen_random_uuid()::text, id, 'ADD_TO_PIPELINE', 'PARTNER_REVIEW',
       'Automatic: the "Add to pipeline" stage was retired', NULL, now()
FROM moved;
