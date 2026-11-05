-- Rollback for 20261106090000_founder_diversity_names (run by hand, then
--   npx prisma migrate resolve --rolled-back 20261106090000_founder_diversity_names).
-- Removes the Playbook version this migration added. The renamed founder themes are left as
-- they are: the old names can't be restored exactly ("Ethnic Minority" and "Global majority"
-- both became "Person of Colour Founder"), and FOUNDER_DIVERSITY_RENAMES reads either.
DELETE FROM "PlaybookVersion" WHERE id = 'pbv-founder-diversity-names';
