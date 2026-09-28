import "server-only";
import { db } from "./db";
import { DECK_BUCKET } from "./deck-storage";

/**
 * List an AI-screened deck under the venture's Documents (category Deck).
 * Idempotent: re-runs reuse the same stored file, so there's one Document per file.
 */
export async function recordDeckDocument(analysisId: string): Promise<void> {
  const a = await db.deckAnalysis.findUnique({ where: { id: analysisId } });
  if (!a?.ventureId) return;
  await db.document.upsert({
    where: { bucket_storagePath: { bucket: DECK_BUCKET, storagePath: a.storagePath } },
    create: {
      ventureId: a.ventureId,
      category: "DECK",
      bucket: DECK_BUCKET,
      storagePath: a.storagePath,
      fileName: a.fileName,
      mimeType: "application/pdf",
      sizeBytes: a.fileSize,
      uploadedById: a.createdById,
      uploadedAt: new Date(),
    },
    update: {},
  });
}
