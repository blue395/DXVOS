-- Founder diversity themes under Kevin's wording (Blue, 2026-11-05). Data fix only, no schema change.
--   Ethnic Minority, Global majority -> Person of Colour Founder; Neurodiversity -> Neurodivergent Founder;
--   Disability -> Disabled Founder; Low socio-economic background -> Founder from socio-economic
--   disadvantaged background; LGBTQ+ -> LGBTQIA+ Founder. Other themes are unchanged. The same
--   renames are FOUNDER_DIVERSITY_RENAMES in src/lib/pipeline.ts (tested against this file).
-- Renames the stored themes on deals, applications and hand-added syndicate investments, and
-- adds a new Assessment Playbook version with the new list (version 0 stays DXV's original).
-- Issued memos (MemoVersion) are never edited: they keep the wording they were issued with.

-- One theme under its new name. Detail the founders gave in brackets is kept, e.g.
-- "Neurodiversity (ADHD)" -> "Neurodivergent Founder (ADHD)".
CREATE FUNCTION pg_temp.dxv_theme(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE WHEN renamed IS NULL THEN t ELSE renamed || coalesce(' ' || substring(t FROM '\(.*\)'), '') END
  FROM (
    SELECT CASE lower(btrim(regexp_replace(t, '\s*\(.*?\)\s*', ' ', 'g')))
      WHEN 'ethnic minority' THEN 'Person of Colour Founder'
      WHEN 'global majority' THEN 'Person of Colour Founder'
      WHEN 'neurodiversity' THEN 'Neurodivergent Founder'
      WHEN 'disability' THEN 'Disabled Founder'
      WHEN 'low socio-economic background' THEN 'Founder from socio-economic disadvantaged background'
      WHEN 'lgbtq+' THEN 'LGBTQIA+ Founder'
    END AS renamed
  ) r
$f$;

-- Renamed, duplicates (ignoring case) removed, first kept, order kept.
CREATE FUNCTION pg_temp.dxv_themes(arr text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(array_agg(v ORDER BY first_pos), '{}')
  FROM (
    SELECT min(v) AS v, min(pos) AS first_pos
    FROM (SELECT pg_temp.dxv_theme(x) AS v, pos FROM unnest(arr) WITH ORDINALITY AS u(x, pos)) m
    GROUP BY lower(v)
  ) d
$f$;

UPDATE "Venture" SET "founderDiversity" = pg_temp.dxv_themes("founderDiversity") WHERE "founderDiversity" IS DISTINCT FROM pg_temp.dxv_themes("founderDiversity");
UPDATE "FounderSubmission" SET "diversityThemes" = pg_temp.dxv_themes("diversityThemes") WHERE "diversityThemes" IS DISTINCT FROM pg_temp.dxv_themes("diversityThemes");
UPDATE "SyndicateHolding" SET "diversityThemes" = pg_temp.dxv_themes("diversityThemes") WHERE "diversityThemes" IS DISTINCT FROM pg_temp.dxv_themes("diversityThemes");

-- A new Assessment Playbook version: Kevin's seven first, then any earlier themes with no match.
DO $do$
DECLARE
  base jsonb;
  next_version int;
  kevin text[] := ARRAY[
    'Female Founder',
    'Person of Colour Founder',
    'Neurodivergent Founder (name the specific condition where stated, e.g. ADHD, autism)',
    'Disabled Founder',
    'Founder from socio-economic disadvantaged background',
    'LGBTQIA+ Founder',
    'First time founder over 50'
  ];
  rest text[];
BEGIN
  SELECT content, version + 1 INTO base, next_version FROM "PlaybookVersion" WHERE kind = 'ASSESSMENT' ORDER BY version DESC LIMIT 1;
  IF base IS NULL THEN
    base := '{"intro":"You are drafting a first-pass Investment Assessment and Memo for Diversity X Ventures (DXV), a UK angel syndicate investing at pre-seed and seed stage in underestimated founders. Use the founder''s deck and any accompanying materials (previous eligibility screen notes, founder correspondence, public information) as your source material.","houseStyle":["No em-dashes, no arrows (write \"to\"), no emoji","Avoid stock AI phrases: \"exceptional,\" \"genuinely,\" \"world-class,\" \"the crux of,\" \"domain-perfect\"","Flag material risks prominently, in the Investment Case or Conclusion, not buried in the scoring table","Be specific. A score with no concrete justification is worse than no score — if the deck doesn''t give you enough to justify a number, say so and score conservatively rather than guess"],"criteria":[{"id":"team","name":"Team","anchors":"1: no team info given or a solo non-technical founder with no relevant background. 3: a credible founder with some relevant experience, gaps in the team. 5: a founding team with direct, demonstrated relevant experience (prior exits, deep domain expertise, or both)."},{"id":"problem-solution-fit","name":"Problem Solution fit","anchors":"1: unclear or unvalidated problem. 3: a real problem with a plausible but unproven solution. 5: a well-evidenced problem with early validation that the solution addresses it."},{"id":"market-scalability","name":"Mkt & scalability","anchors":"1: niche market with an unclear path to scale. 3: a reasonable market with a plausible scaling story. 5: a large, well-sized market (bottom-up, not just TAM) with a credible scaling mechanism."},{"id":"unit-economics","name":"Unit Economics","anchors":"1: not disclosed or clearly unworkable. 3: plausible but unproven at scale. 5: disclosed, credible, and stress-tested against realistic costs."},{"id":"financial-returns","name":"Financial Returns","anchors":"1: no realistic path to a venture-scale return. 3: plausible 3 to 5x return case. 5: strong, well-evidenced return potential with comparable exits cited."},{"id":"valuation","name":"Valuation","anchors":"1: unsubstantiated or aggressive relative to stage and evidence. 3: broadly in line with comparable pre-seed/seed deals. 5: conservative and well-justified relative to milestones achieved."},{"id":"risks","name":"Risks","anchors":"general commercial and execution risk. 1: severe, unaddressed risks. 3: real risks with a credible mitigation path. 5: risks are well understood and actively managed."},{"id":"market-traction","name":"Market traction","anchors":"1: no traction. 3: early signals (waitlist, pilot, LOIs). 5: real revenue, retention, or committed customers at a meaningful scale for the stage."},{"id":"legal-documentation","name":"Legal Documentation","anchors":"1: nothing seen (cap table, IP assignment, instrument terms). 3: partially available. 5: clean, complete, and consistent with what''s being proposed (SEIS/EIS eligibility, ASA terms where relevant)."},{"id":"impact","name":"Impact","anchors":"scored against DXV''s actual impact themes (see §3), not general ESG framing. 1: no clear impact thesis. 3: a stated but thin impact angle. 5: a clear, well-evidenced impact thesis tied to a named theme."},{"id":"risks-red-flags","name":"Risks/Red Flags","anchors":"specific deal-breaking concerns distinct from #7''s general risk assessment (regulatory exposure, an unresolved dispute, a governance issue). 1: a serious red flag present. 5: none identified. If this duplicates #7 in practice for a given deal, say so rather than padding two different-sounding paragraphs with the same content."}],"impactThemes":["FemTech","Climate","Health","Social Mobility","Financial Wellbeing"],"diversityThemes":["Female Founder","LGBTQ+","Disability","Ethnic Minority","Immigrant","Low socio-economic background","Neurodiversity (name the specific condition where stated, e.g. ADHD, autism)","Not university educated","Global majority","Experienced homelessness"],"taxonomyGuidance":"Same rule as the eligibility screen: only apply a Diversity Theme tag where the deck or founder correspondence states it directly. Never infer a founder''s background from a name, photo, accent in a video, or any other proxy. If it isn''t stated, write \"not stated\" in the Impact thesis header field and flag it as a follow-up question for the founder, rather than leaving DXV''s thesis-fit assessment resting on an assumption."}'::jsonb;
    next_version := 1;
  END IF;
  SELECT coalesce(array_agg(t ORDER BY pos), '{}') INTO rest
  FROM (
    SELECT pg_temp.dxv_theme(x) AS t, pos
    FROM jsonb_array_elements_text(coalesce(base -> 'diversityThemes', '[]')) WITH ORDINALITY AS u(x, pos)
  ) m
  WHERE lower(btrim(regexp_replace(t, '\s*\(.*?\)\s*', ' ', 'g'))) NOT IN (
    SELECT lower(btrim(regexp_replace(k, '\s*\(.*?\)\s*', ' ', 'g'))) FROM unnest(kevin) AS k
  );
  INSERT INTO "PlaybookVersion" (id, kind, version, content, note, "createdById", "createdAt")
  VALUES (
    'pbv-founder-diversity-names',
    'ASSESSMENT',
    next_version,
    jsonb_set(base, '{diversityThemes}', to_jsonb(kevin || rest)),
    'Founder diversity themes renamed to Kevin''s wording (Blue, 2026-11-05); "First time founder over 50" added.',
    'system-website',
    now()
  );
END
$do$;
