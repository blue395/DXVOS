-- CreateEnum
CREATE TYPE "PortalViewKind" AS ENUM ('HOME', 'BOARD', 'DEAL', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "PortalView" (
    "id" TEXT NOT NULL,
    "angelId" TEXT NOT NULL,
    "kind" "PortalViewKind" NOT NULL,
    "ventureId" TEXT,
    "team" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalView_createdAt_idx" ON "PortalView"("createdAt");

-- CreateIndex
CREATE INDEX "PortalView_angelId_createdAt_idx" ON "PortalView"("angelId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalView_ventureId_idx" ON "PortalView"("ventureId");

-- AddForeignKey
ALTER TABLE "PortalView" ADD CONSTRAINT "PortalView_angelId_fkey" FOREIGN KEY ("angelId") REFERENCES "Angel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Data API exposure: keep the table private to the server.
ALTER TABLE "PortalView" ENABLE ROW LEVEL SECURITY;
