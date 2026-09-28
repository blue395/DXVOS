-- AlterTable
ALTER TABLE "MemoDraft" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 1;


-- Backfill (memo naming: DXV Review Draft N becomes DXV Review Issue N).
-- 1. Each draft's number = issues on its venture created before the draft + 1.
UPDATE "MemoDraft" d
SET number = 1 + (
  SELECT count(*) FROM "MemoVersion" v
  WHERE v."ventureId" = d."ventureId" AND v.kind = 'REVIEWED_MEMO' AND v."createdAt" < d."createdAt"
);

-- 2. An open draft that was already issued and not edited since is now closed
--    (under the new flow, marking a draft complete closes it).
UPDATE "MemoDraft" d
SET "archivedAt" = now()
WHERE d."archivedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "MemoVersion" v
    WHERE v."ventureId" = d."ventureId" AND v.kind = 'REVIEWED_MEMO'
      AND v."createdAt" >= d."createdAt" AND v."createdAt" >= d."updatedAt"
  );

-- 3. An open draft edited after its issue continues as the next draft (Issue count + 1).
UPDATE "MemoDraft" d
SET number = 1 + (
  SELECT count(*) FROM "MemoVersion" v
  WHERE v."ventureId" = d."ventureId" AND v.kind = 'REVIEWED_MEMO'
)
WHERE d."archivedAt" IS NULL;
