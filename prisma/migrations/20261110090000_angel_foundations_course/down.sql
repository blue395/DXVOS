-- Course opt-ins (no link) must be removed before linkId can be required again.
DELETE FROM "MemberJoinRequest" WHERE "linkId" IS NULL;
ALTER TABLE "MemberJoinRequest" DROP CONSTRAINT "MemberJoinRequest_learnerId_fkey";
ALTER TABLE "MemberJoinRequest" DROP COLUMN "learnerId";
ALTER TABLE "MemberJoinRequest" DROP CONSTRAINT "MemberJoinRequest_linkId_fkey";
ALTER TABLE "MemberJoinRequest" ALTER COLUMN "linkId" SET NOT NULL;
ALTER TABLE "MemberJoinRequest" ADD CONSTRAINT "MemberJoinRequest_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MemberJoinLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TABLE "CourseConsent";
DROP TABLE "CourseProgress";
DROP TABLE "CourseLearner";
DROP TYPE "CourseConsentKind";
DROP TYPE "LearnerDescribesAs";
-- Enum values LEARNER (Role) and WITHDRAWN (JoinRequestStatus) can't be dropped in Postgres;
-- they are harmless once unused (move any LEARNER logins to another role first).
