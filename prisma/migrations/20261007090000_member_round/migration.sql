-- CreateTable
CREATE TABLE "MemberRound" (
    "id" TEXT NOT NULL,
    "round" INTEGER,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberRound_createdAt_idx" ON "MemberRound"("createdAt");

-- AddForeignKey
ALTER TABLE "MemberRound" ADD CONSTRAINT "MemberRound_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase Data API exposure: the new table is private (the app connects as the owner).
ALTER TABLE "MemberRound" ENABLE ROW LEVEL SECURITY;
