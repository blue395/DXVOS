-- Phase 2 of moving members' diversity answers off the profile (Blue, 2026-10-23).
-- Re-checks that every old diversity pill on Angel.tags has its copy in DiversityPending
-- (made by 20261024090000_diversity_store), then removes those pills from Angel.tags.
-- Experience tags (First-time angel, Founder, Operator, Lead angel experience, anything
-- else) stay. Rollback: down.sql in this folder restores them from DiversityPending.

-- The copy is behind FORCEd row-level security, so check it as the system role.
SET ROLE dxv_diversity_system;
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM "Angel" a, unnest(a.tags) t
  WHERE a."erasedAt" IS NULL
    AND lower(btrim(t)) IN ('disabled', 'neurodiverse', 'lgbtq+', 'female angel', 'woman angel', 'not university educated',
                            'experienced care', 'experienced homelessness', 'low socio-economic background', 'immigrant')
    AND NOT EXISTS (SELECT 1 FROM "DiversitySubject" s JOIN "DiversityPending" p ON p."subjectId" = s.id WHERE s."angelId" = a.id);
  IF missing > 0 THEN
    RAISE EXCEPTION 'Not removing old diversity tags: % have no copy in DiversityPending', missing;
  END IF;
END $$;
RESET ROLE;

UPDATE "Angel"
SET tags = coalesce((
  SELECT array_agg(t ORDER BY ord) FROM unnest(tags) WITH ORDINALITY AS u(t, ord)
  WHERE lower(btrim(t)) NOT IN ('disabled', 'neurodiverse', 'lgbtq+', 'female angel', 'woman angel', 'not university educated',
                                'experienced care', 'experienced homelessness', 'low socio-economic background', 'immigrant')
), '{}')
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) t
  WHERE lower(btrim(t)) IN ('disabled', 'neurodiverse', 'lgbtq+', 'female angel', 'woman angel', 'not university educated',
                            'experienced care', 'experienced homelessness', 'low socio-economic background', 'immigrant')
);
