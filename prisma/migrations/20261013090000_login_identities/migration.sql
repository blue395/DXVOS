-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateTable
CREATE TABLE "LoginIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailChoiceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "LoginIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginIdentity_userId_idx" ON "LoginIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginIdentity_provider_subject_key" ON "LoginIdentity"("provider", "subject");

-- AddForeignKey
ALTER TABLE "LoginIdentity" ADD CONSTRAINT "LoginIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase Data API exposure: keep the table private to the server.
ALTER TABLE "LoginIdentity" ENABLE ROW LEVEL SECURITY;
