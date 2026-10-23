-- Rollback for 20261024090000_diversity_store (run by hand, then:
--   npx prisma migrate resolve --rolled-back 20261024090000_diversity_store).
-- Roll back 20261024090100_diversity_remove_old_tags first (its down.sql puts the old
-- pills back on Angel.tags from DiversityPending), or the carried-over answers are lost.
-- WARNING: this deletes every diversity answer and consent record.
DROP FUNCTION IF EXISTS dxv_diversity_for_angel(text, text, text);
DROP FUNCTION IF EXISTS dxv_diversity_counts();
DROP TABLE IF EXISTS "DiversityAccessLog", "DiversityPending", "DiversityConsentLog", "DiversityConsent", "DiversityAnswer", "DiversitySubject" CASCADE;
DROP FUNCTION IF EXISTS dxv_append_only(), dxv_consent_delete_guard(), dxv_consent_withdrawn(), dxv_answer_needs_consent(), dxv_my_subject(), dxv_current_angel();
DROP TYPE IF EXISTS "ConsentMethod", "ConsentStatus", "DiversityCategory";
ALTER TABLE "Angel" DROP COLUMN IF EXISTS "ageConfirmedAt", DROP COLUMN IF EXISTS "diversityPromptedAt";
DROP POLICY IF EXISTS diversity_roles_read ON "Angel";
DROP POLICY IF EXISTS diversity_system_read ON "User";
DROP POLICY IF EXISTS diversity_system_read ON "PortalView";
REVOKE USAGE ON SCHEMA public FROM dxv_member, dxv_diversity_admin, dxv_diversity_system, dxv_diversity_reader;
REVOKE SELECT ON "Angel", "User" FROM dxv_diversity_reader;
REVOKE SELECT ON "Angel", "User", "PortalView" FROM dxv_diversity_system;
-- Roles belong to the whole server: keep any still used by another database (e.g. a test copy).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['dxv_member', 'dxv_diversity_admin', 'dxv_diversity_system', 'dxv_diversity_reader'] LOOP
    BEGIN
      EXECUTE format('DROP ROLE IF EXISTS %I', r);
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Kept role % (another database still uses it)', r;
    END;
  END LOOP;
END $$;
