-- Instant shareable sign-up links (Blue, 2026-11-05): no partner approval; capped and short-lived.

-- AlterTable
ALTER TABLE "MemberJoinLink" ADD COLUMN     "instant" BOOLEAN NOT NULL DEFAULT false;

