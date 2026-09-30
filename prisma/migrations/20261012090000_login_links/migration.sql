-- CreateEnum
CREATE TYPE "LoginLinkKind" AS ENUM ('RESET', 'MAGIC');

-- CreateTable
CREATE TABLE "LoginLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LoginLinkKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginLink_tokenHash_key" ON "LoginLink"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginLink_userId_createdAt_idx" ON "LoginLink"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoginLink" ADD CONSTRAINT "LoginLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase Data API exposure: keep the table private to the server.
ALTER TABLE "LoginLink" ENABLE ROW LEVEL SECURITY;
