-- Board deck intake: a light read (name, founder, stage) without an eligibility screen.
ALTER TABLE "DeckAnalysis" ADD COLUMN "intakeOnly" BOOLEAN NOT NULL DEFAULT false;

-- Company Stage is now a dropdown (Pre-Seed, Seed, Series A, Bridge Round, or other text).
-- Bring existing free-text values onto the dropdown's spellings.
UPDATE "Venture" SET "companyStage" = 'Pre-Seed'
  WHERE lower(regexp_replace("companyStage", '[\s_-]+', '', 'g')) = 'preseed';
UPDATE "Venture" SET "companyStage" = 'Seed'
  WHERE lower(regexp_replace("companyStage", '[\s_-]+', '', 'g')) = 'seed';
UPDATE "Venture" SET "companyStage" = 'Series A'
  WHERE lower(regexp_replace("companyStage", '[\s_-]+', '', 'g')) = 'seriesa';
UPDATE "Venture" SET "companyStage" = 'Bridge Round'
  WHERE lower("companyStage") LIKE '%bridge%';
UPDATE "Venture" SET "companyStage" = NULL WHERE trim("companyStage") = '';
