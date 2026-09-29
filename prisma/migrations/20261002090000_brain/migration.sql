-- DXV Brain (2026-10-02): private AI assistant chats. Additive only.

-- CreateEnum
CREATE TYPE "BrainRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "BrainConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrainConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "BrainRole" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "content" JSONB,
    "pagePath" TEXT,
    "ventureId" TEXT,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'COMPLETE',
    "activity" TEXT,
    "sources" JSONB,
    "error" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BrainMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrainConversation_userId_updatedAt_idx" ON "BrainConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "BrainMessage_conversationId_createdAt_idx" ON "BrainMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrainConversation" ADD CONSTRAINT "BrainConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainMessage" ADD CONSTRAINT "BrainMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BrainConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase Data API exposure: nothing reads these tables through it.
ALTER TABLE "BrainConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrainMessage" ENABLE ROW LEVEL SECURITY;
