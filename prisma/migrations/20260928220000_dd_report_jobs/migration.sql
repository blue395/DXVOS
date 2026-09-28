-- CreateTable
CREATE TABLE "DDReportJob" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "status" "DeckAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "context" JSONB NOT NULL,
    "output" JSONB,
    "documentId" TEXT,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DDReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DDReportJob_documentId_key" ON "DDReportJob"("documentId");

-- CreateIndex
CREATE INDEX "DDReportJob_ventureId_createdAt_idx" ON "DDReportJob"("ventureId", "createdAt");

-- AddForeignKey
ALTER TABLE "DDReportJob" ADD CONSTRAINT "DDReportJob_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DDReportJob" ADD CONSTRAINT "DDReportJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DDReportJob" ADD CONSTRAINT "DDReportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Row Level Security (no policies): keep out of Supabase's Data API.
ALTER TABLE "DDReportJob" ENABLE ROW LEVEL SECURITY;
