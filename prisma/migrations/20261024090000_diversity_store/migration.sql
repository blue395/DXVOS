-- CreateEnum
CREATE TYPE "DiversityCategory" AS ENUM ('health', 'sexual_orientation', 'ethnicity', 'religion', 'gender_background');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('given', 'withdrawn');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('signup_screen', 'profile_edit', 'admin_on_request', 'retention', 'migration');

-- AlterTable
ALTER TABLE "Angel" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "diversityPromptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DiversitySubject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "angelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiversitySubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiversityAnswer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subjectId" UUID NOT NULL,
    "category" "DiversityCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "selfDescribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiversityAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiversityConsent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subjectId" UUID NOT NULL,
    "category" "DiversityCategory" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "method" "ConsentMethod" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiversityConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiversityConsentLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subjectId" UUID NOT NULL,
    "category" "DiversityCategory" NOT NULL,
    "action" "ConsentStatus" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "method" "ConsentMethod" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiversityConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiversityPending" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subjectId" UUID NOT NULL,
    "category" "DiversityCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiversityPending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiversityAccessLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subjectId" UUID NOT NULL,
    "viewerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiversityAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiversitySubject_angelId_key" ON "DiversitySubject"("angelId");

-- CreateIndex
CREATE INDEX "DiversityAnswer_subjectId_category_idx" ON "DiversityAnswer"("subjectId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DiversityAnswer_subjectId_question_value_key" ON "DiversityAnswer"("subjectId", "question", "value");

-- CreateIndex
CREATE UNIQUE INDEX "DiversityConsent_subjectId_category_key" ON "DiversityConsent"("subjectId", "category");

-- CreateIndex
CREATE INDEX "DiversityConsentLog_subjectId_at_idx" ON "DiversityConsentLog"("subjectId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "DiversityPending_subjectId_question_value_key" ON "DiversityPending"("subjectId", "question", "value");

-- CreateIndex
CREATE INDEX "DiversityAccessLog_subjectId_at_idx" ON "DiversityAccessLog"("subjectId", "at");

-- AddForeignKey
ALTER TABLE "DiversitySubject" ADD CONSTRAINT "DiversitySubject_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityAnswer" ADD CONSTRAINT "DiversityAnswer_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DiversitySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityConsent" ADD CONSTRAINT "DiversityConsent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DiversitySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityConsentLog" ADD CONSTRAINT "DiversityConsentLog_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DiversitySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityPending" ADD CONSTRAINT "DiversityPending_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DiversitySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityAccessLog" ADD CONSTRAINT "DiversityAccessLog_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "DiversitySubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiversityAccessLog" ADD CONSTRAINT "DiversityAccessLog_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Members' diversity information (Blue, 2026-10-23; docs/privacy). Hand-written below.
-- Rollback: down.sql in this folder (run it by hand, then `prisma migrate resolve
-- --rolled-back 20261024090000_diversity_store`).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Carry over the old "About you" pills (Angel.tags) as PENDING answers ──
-- They were given without explicit consent, so they are only held for the member to
-- confirm or remove (pre-filled on their consent screen), never counted or shown to the
-- team, and deleted after 60 days. Angel.tags is not touched here: the next migration
-- removes them, after checking this copy again.
CREATE TEMP TABLE "_legacy_diversity_map" (tag text PRIMARY KEY, category "DiversityCategory", question text, value text);
INSERT INTO "_legacy_diversity_map" VALUES
  ('disabled',                      'health',             'disability',           'Yes, disability'),
  ('neurodiverse',                  'health',             'disability',           'Yes, neurodivergent'),
  ('lgbtq+',                        'sexual_orientation', 'sexual_orientation',   'LGBTQ+'),
  ('female angel',                  'gender_background',  'gender',               'Woman'),
  ('woman angel',                   'gender_background',  'gender',               'Woman'),
  ('not university educated',       'gender_background',  'first_gen_university', 'I didn''t go to university'),
  ('experienced care',              'gender_background',  'life_experience',      'I''ve been in care'),
  ('experienced homelessness',      'gender_background',  'life_experience',      'I''ve experienced homelessness'),
  ('low socio-economic background', 'gender_background',  'life_experience',      'I grew up in a low-income household'),
  ('immigrant',                     'gender_background',  'life_experience',      'I moved to the UK from another country');

CREATE TEMP TABLE "_legacy_diversity" AS
SELECT DISTINCT a.id AS "angelId", m.category, m.question,
  -- Both Disabled and Neurodiverse ticked: one answer, "Yes, both".
  CASE WHEN m.question = 'disability'
        AND EXISTS (SELECT 1 FROM unnest(a.tags) t2 WHERE lower(btrim(t2)) = 'disabled')
        AND EXISTS (SELECT 1 FROM unnest(a.tags) t3 WHERE lower(btrim(t3)) = 'neurodiverse')
       THEN 'Yes, both' ELSE m.value END AS value
FROM "Angel" a, unnest(a.tags) t
JOIN "_legacy_diversity_map" m ON m.tag = lower(btrim(t))
WHERE a."erasedAt" IS NULL;

INSERT INTO "DiversitySubject" ("angelId")
SELECT DISTINCT "angelId" FROM "_legacy_diversity";

INSERT INTO "DiversityPending" ("subjectId", category, question, value, "expiresAt")
SELECT s.id, l.category, l.question, l.value, CURRENT_TIMESTAMP + interval '60 days'
FROM "_legacy_diversity" l JOIN "DiversitySubject" s ON s."angelId" = l."angelId";

-- Verify the copy before going on: every answer copied, every member covered.
DO $$
DECLARE expected int; copied int; members int; subjects int;
BEGIN
  SELECT count(*) INTO expected FROM "_legacy_diversity";
  SELECT count(*) INTO copied FROM "DiversityPending";
  SELECT count(DISTINCT "angelId") INTO members FROM "_legacy_diversity";
  SELECT count(*) INTO subjects FROM "DiversitySubject";
  IF expected <> copied OR members <> subjects THEN
    RAISE EXCEPTION 'Diversity copy check failed: % answers expected, % copied; % members, % subjects', expected, copied, members, subjects;
  END IF;
  RAISE NOTICE 'Diversity copy check passed: % answers for % members', copied, members;
END $$;
DROP TABLE "_legacy_diversity";
DROP TABLE "_legacy_diversity_map";

-- ── 2. Roles: least privilege, no login. The app's own role switches into them per transaction.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dxv_member') THEN CREATE ROLE dxv_member NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dxv_diversity_admin') THEN CREATE ROLE dxv_diversity_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dxv_diversity_system') THEN CREATE ROLE dxv_diversity_system NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dxv_diversity_reader') THEN CREATE ROLE dxv_diversity_reader NOLOGIN; END IF;
END $$;
GRANT dxv_member, dxv_diversity_admin, dxv_diversity_system, dxv_diversity_reader TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO dxv_member, dxv_diversity_admin, dxv_diversity_system, dxv_diversity_reader;

-- Members: their own rows only (policies below). The admin role gets NO table access: only the functions.
GRANT SELECT, INSERT ON "DiversitySubject" TO dxv_member;
GRANT SELECT, INSERT, UPDATE, DELETE ON "DiversityAnswer", "DiversityConsent", "DiversityPending" TO dxv_member;
GRANT SELECT, INSERT ON "DiversityConsentLog" TO dxv_member;
-- System jobs (retention, account erasure, admin-on-request).
GRANT SELECT, INSERT, UPDATE, DELETE ON "DiversitySubject", "DiversityAnswer", "DiversityConsent", "DiversityConsentLog", "DiversityPending" TO dxv_diversity_system;
GRANT SELECT, DELETE ON "DiversityAccessLog" TO dxv_diversity_system;
-- The functions' owner: reads answers and consents, writes the access log.
GRANT SELECT ON "DiversitySubject", "DiversityAnswer", "DiversityConsent" TO dxv_diversity_reader;
GRANT INSERT ON "DiversityAccessLog" TO dxv_diversity_reader;
GRANT SELECT ON "Angel" TO dxv_diversity_reader, dxv_diversity_system;
-- The retention job checks activity (last sign-in, portal visits).
GRANT SELECT ON "User", "PortalView" TO dxv_diversity_system;
-- These tables have RLS on with no policies (only the app's owner role reads them), so the
-- two roles need a read policy of their own: active members only (reader), activity (system).
CREATE POLICY diversity_roles_read ON "Angel" FOR SELECT USING (current_user IN ('dxv_diversity_reader', 'dxv_diversity_system'));
CREATE POLICY diversity_system_read ON "User" FOR SELECT USING (current_user IN ('dxv_diversity_reader', 'dxv_diversity_system'));
CREATE POLICY diversity_system_read ON "PortalView" FOR SELECT USING (current_user = 'dxv_diversity_system');

-- ── 3. Row-level security, FORCEd (applies to the table owner too) ────────────
ALTER TABLE "DiversitySubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversityAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversityConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversityConsentLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversityPending" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversityAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiversitySubject" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiversityAnswer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiversityConsent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiversityConsentLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiversityPending" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiversityAccessLog" FORCE ROW LEVEL SECURITY;

-- The signed-in member, set by the app for each transaction (src/lib/diversity/store.ts).
CREATE FUNCTION dxv_current_angel() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('dxv.angel_id', true), '') $$;
CREATE FUNCTION dxv_my_subject() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM "DiversitySubject" WHERE "angelId" = dxv_current_angel() $$;

-- Policies check the ACTIVE role (current_user), not role membership: the app's own login
-- role is a member of these roles (so it can switch into them), and a "TO role" policy
-- would also apply to it. With no policy matching the app's own role, FORCEd RLS shows it
-- nothing: every read and write goes through a switched role.
CREATE POLICY member_own_subject ON "DiversitySubject"
  USING (current_user = 'dxv_member' AND "angelId" = dxv_current_angel())
  WITH CHECK (current_user = 'dxv_member' AND "angelId" = dxv_current_angel());
CREATE POLICY member_own_answers ON "DiversityAnswer"
  USING (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject())
  WITH CHECK (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject());
CREATE POLICY member_own_consents ON "DiversityConsent"
  USING (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject())
  WITH CHECK (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject());
CREATE POLICY member_own_consent_log ON "DiversityConsentLog"
  USING (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject())
  WITH CHECK (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject());
CREATE POLICY member_own_pending ON "DiversityPending"
  USING (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject())
  WITH CHECK (current_user = 'dxv_member' AND "subjectId" = dxv_my_subject());

CREATE POLICY system_all ON "DiversitySubject" USING (current_user = 'dxv_diversity_system') WITH CHECK (current_user = 'dxv_diversity_system');
CREATE POLICY system_all ON "DiversityAnswer" USING (current_user = 'dxv_diversity_system') WITH CHECK (current_user = 'dxv_diversity_system');
CREATE POLICY system_all ON "DiversityConsent" USING (current_user = 'dxv_diversity_system') WITH CHECK (current_user = 'dxv_diversity_system');
CREATE POLICY system_all ON "DiversityConsentLog" USING (current_user = 'dxv_diversity_system') WITH CHECK (current_user = 'dxv_diversity_system');
CREATE POLICY system_all ON "DiversityPending" USING (current_user = 'dxv_diversity_system') WITH CHECK (current_user = 'dxv_diversity_system');
CREATE POLICY system_all ON "DiversityAccessLog" FOR SELECT USING (current_user = 'dxv_diversity_system');
CREATE POLICY system_delete ON "DiversityAccessLog" FOR DELETE USING (current_user = 'dxv_diversity_system');

-- The admin functions run as their owner, dxv_diversity_reader.
CREATE POLICY reader_all ON "DiversitySubject" FOR SELECT USING (current_user = 'dxv_diversity_reader');
CREATE POLICY reader_all ON "DiversityAnswer" FOR SELECT USING (current_user = 'dxv_diversity_reader');
CREATE POLICY reader_all ON "DiversityConsent" FOR SELECT USING (current_user = 'dxv_diversity_reader');
CREATE POLICY reader_log ON "DiversityAccessLog" FOR INSERT WITH CHECK (current_user = 'dxv_diversity_reader');

-- ── 4. An answer can never exist without a given consent for its category ───
CREATE FUNCTION dxv_answer_needs_consent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "DiversityConsent" c
    WHERE c."subjectId" = NEW."subjectId" AND c.category = NEW.category AND c.status = 'given'
  ) THEN
    RAISE EXCEPTION 'dxv: a diversity answer needs a given consent for its category' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER answer_needs_consent BEFORE INSERT OR UPDATE ON "DiversityAnswer"
  FOR EACH ROW EXECUTE FUNCTION dxv_answer_needs_consent();

-- Withdrawing consent deletes that category's answers, in the same transaction.
CREATE FUNCTION dxv_consent_withdrawn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "DiversityAnswer" WHERE "subjectId" = NEW."subjectId" AND category = NEW.category;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_withdrawn AFTER UPDATE OF status ON "DiversityConsent"
  FOR EACH ROW WHEN (NEW.status = 'withdrawn') EXECUTE FUNCTION dxv_consent_withdrawn();

-- A consent row can't be deleted while answers rely on it.
CREATE FUNCTION dxv_consent_delete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "DiversityAnswer" a WHERE a."subjectId" = OLD."subjectId" AND a.category = OLD.category) THEN
    RAISE EXCEPTION 'dxv: withdraw consent (which deletes the answers) before deleting it' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER consent_delete_guard BEFORE DELETE ON "DiversityConsent"
  FOR EACH ROW EXECUTE FUNCTION dxv_consent_delete_guard();

-- Append-only logs.
CREATE FUNCTION dxv_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'dxv: % is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege'; END $$;
CREATE TRIGGER consent_log_append_only BEFORE UPDATE ON "DiversityConsentLog" FOR EACH ROW EXECUTE FUNCTION dxv_append_only();
CREATE TRIGGER access_log_append_only BEFORE UPDATE ON "DiversityAccessLog" FOR EACH ROW EXECUTE FUNCTION dxv_append_only();

-- ── 5. The admin role's only ways in ─────────────────────────────────────────
-- Raw counts of consented answers from active members. The small-number rule (never a
-- group under 10) is applied in code before anything is shown: src/lib/diversity/report.ts.
CREATE FUNCTION dxv_diversity_counts()
RETURNS TABLE (question text, value text, self_described boolean, n bigint, respondents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH live AS (
    SELECT a.* FROM "DiversityAnswer" a
    JOIN "DiversitySubject" s ON s.id = a."subjectId"
    JOIN "Angel" g ON g.id = s."angelId" AND g."archivedAt" IS NULL AND g."erasedAt" IS NULL
    JOIN "DiversityConsent" c ON c."subjectId" = a."subjectId" AND c.category = a.category AND c.status = 'given'
  )
  SELECT l.question,
         CASE WHEN l."selfDescribed" THEN 'Self-described' ELSE l.value END,
         l."selfDescribed",
         count(DISTINCT l."subjectId"),
         (SELECT count(DISTINCT x."subjectId") FROM live x WHERE x.question = l.question)
  FROM live l
  GROUP BY 1, 2, 3
$$;

-- One member's answers, for a named partner with a stated reason. Every call is logged
-- (who, when, why) inside the function, so a read can't happen without its log row.
CREATE FUNCTION dxv_diversity_for_angel(p_angel text, p_viewer text, p_reason text)
RETURNS TABLE (category "DiversityCategory", question text, value text, self_described boolean, consent_given_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE subj uuid;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'dxv: give a reason for viewing this member''s diversity information' USING ERRCODE = 'check_violation';
  END IF;
  SELECT id INTO subj FROM "DiversitySubject" WHERE "angelId" = p_angel;
  IF subj IS NULL THEN RETURN; END IF;
  INSERT INTO "DiversityAccessLog" ("subjectId", "viewerId", reason) VALUES (subj, p_viewer, left(btrim(p_reason), 300));
  RETURN QUERY
    SELECT a.category, a.question, a.value, a."selfDescribed", c."givenAt"
    FROM "DiversityAnswer" a
    JOIN "DiversityConsent" c ON c."subjectId" = a."subjectId" AND c.category = a.category AND c.status = 'given'
    WHERE a."subjectId" = subj
    ORDER BY a.category, a.question, a.value;
END $$;

-- Owned by the reader role, so they run with its narrow rights (the app's own role is
-- subject to FORCEd RLS here and has no policy). Changing owner needs CREATE on the
-- schema only for the moment of the change.
GRANT CREATE ON SCHEMA public TO dxv_diversity_reader;
ALTER FUNCTION dxv_diversity_counts() OWNER TO dxv_diversity_reader;
ALTER FUNCTION dxv_diversity_for_angel(text, text, text) OWNER TO dxv_diversity_reader;
REVOKE CREATE ON SCHEMA public FROM dxv_diversity_reader;
REVOKE ALL ON FUNCTION dxv_diversity_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION dxv_diversity_for_angel(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dxv_diversity_counts() TO dxv_diversity_admin;
GRANT EXECUTE ON FUNCTION dxv_diversity_for_angel(text, text, text) TO dxv_diversity_admin;
-- The access-log FK to "User" is checked as the function owner.
GRANT SELECT ON "User" TO dxv_diversity_reader;
-- Supabase's API roles (if present) get nothing.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "DiversitySubject", "DiversityAnswer", "DiversityConsent", "DiversityConsentLog", "DiversityPending", "DiversityAccessLog" FROM anon';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON "DiversitySubject", "DiversityAnswer", "DiversityConsent", "DiversityConsentLog", "DiversityPending", "DiversityAccessLog" FROM authenticated';
  END IF;
END $$;
