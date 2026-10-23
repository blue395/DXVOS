-- Rollback for 20261024090100_diversity_remove_old_tags (run by hand, then:
--   npx prisma migrate resolve --rolled-back 20261024090100_diversity_remove_old_tags).
-- Puts the old pills back on Angel.tags from the carried-over answers that are still
-- pending (answers a member has since confirmed or removed are not put back).
SET ROLE dxv_diversity_system;
CREATE TEMP TABLE "_restore" AS
SELECT s."angelId", CASE p.value
    WHEN 'Yes, disability' THEN 'Disabled' WHEN 'Yes, neurodivergent' THEN 'Neurodiverse' WHEN 'Yes, both' THEN 'Disabled'
    WHEN 'LGBTQ+' THEN 'LGBTQ+' WHEN 'Woman' THEN 'Female angel'
    WHEN 'I didn''t go to university' THEN 'Not university educated' WHEN 'I''ve been in care' THEN 'Experienced care'
    WHEN 'I''ve experienced homelessness' THEN 'Experienced homelessness'
    WHEN 'I grew up in a low-income household' THEN 'Low socio-economic background'
    WHEN 'I moved to the UK from another country' THEN 'Immigrant' END AS tag
FROM "DiversityPending" p JOIN "DiversitySubject" s ON s.id = p."subjectId"
UNION ALL
SELECT s."angelId", 'Neurodiverse' FROM "DiversityPending" p JOIN "DiversitySubject" s ON s.id = p."subjectId" WHERE p.value = 'Yes, both';
RESET ROLE;
UPDATE "Angel" a SET tags = a.tags || ARRAY(SELECT r.tag FROM "_restore" r WHERE r."angelId" = a.id AND r.tag IS NOT NULL AND NOT (r.tag = ANY (a.tags)))
WHERE EXISTS (SELECT 1 FROM "_restore" r WHERE r."angelId" = a.id);
DROP TABLE "_restore";
