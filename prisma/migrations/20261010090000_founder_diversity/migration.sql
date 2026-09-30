-- AlterTable
ALTER TABLE "Venture" ADD COLUMN     "founderDiversity" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill (one source of truth from now on): each deal's latest issued memo's diversity themes...
UPDATE "Venture" v
SET "founderDiversity" = ARRAY(SELECT jsonb_array_elements_text(m.content::jsonb -> 'header' -> 'diversityThemes'))
FROM (
  SELECT DISTINCT ON ("ventureId") "ventureId", content
  FROM "MemoVersion"
  WHERE kind = 'REVIEWED_MEMO' AND content IS NOT NULL
  ORDER BY "ventureId", version DESC
) m
WHERE m."ventureId" = v.id
  AND jsonb_typeof(m.content::jsonb -> 'header' -> 'diversityThemes') = 'array';

-- ...then themes the team set on the Portfolio page for a tracked deal (set by hand, so they win).
UPDATE "Venture" v
SET "founderDiversity" = h."diversityThemes"
FROM "SyndicateHolding" h
WHERE h."ventureId" = v.id AND cardinality(h."diversityThemes") > 0;
