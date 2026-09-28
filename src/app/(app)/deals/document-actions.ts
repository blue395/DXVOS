"use server";

// Deal documents stored in DXV OS (Supabase Storage).
// Flow: startDocumentUpload → browser uploads directly to storage → confirmDocumentUpload.
// Documents are never deleted (DXV keeps all deal material); mistakes are archived.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DocumentCategory } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUploadTargetIn, objectExists, objectPath, type UploadTarget } from "@/lib/deck-storage";
import { checkUpload, DOCUMENTS_BUCKET } from "@/lib/documents";
import type { ActionResult } from "@/lib/action-result";

const StartSchema = z.object({
  ventureId: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int(),
  category: z.enum(DocumentCategory),
  ddItemId: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export type StartDocumentResult = { error: string } | { documentId: string; target: UploadTarget };

export async function startDocumentUpload(input: z.input<typeof StartSchema>): Promise<StartDocumentResult> {
  const user = await requireAdmin();
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid upload" };
  const { ventureId, fileName, fileSize, category, ddItemId, note } = parsed.data;

  const check = checkUpload(fileName, fileSize);
  if ("error" in check) return { error: check.error };
  if (!(await db.venture.findUnique({ where: { id: ventureId }, select: { id: true } }))) return { error: "Venture not found." };
  if (ddItemId && !(await db.dDItem.findFirst({ where: { id: ddItemId, ventureId }, select: { id: true } }))) {
    return { error: "DD item not found." };
  }

  const id = randomUUID();
  const storagePath = objectPath(id, fileName);
  await db.document.create({
    data: {
      id,
      ventureId,
      category,
      bucket: DOCUMENTS_BUCKET,
      storagePath,
      fileName,
      mimeType: check.mimeType,
      sizeBytes: fileSize,
      ddItemId: ddItemId ?? null,
      note: note || null,
      uploadedById: user.id,
    },
  });
  try {
    return { documentId: id, target: await createUploadTargetIn(DOCUMENTS_BUCKET, storagePath, `/api/dev/document-upload/${id}`) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't prepare the upload." };
  }
}

/** Called once the browser has finished uploading. Only then does the document appear. */
export async function confirmDocumentUpload(documentId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Upload not found." };
  if (doc.uploadedAt) return { ok: true };
  if (!(await objectExists(doc.bucket, doc.storagePath))) return { error: "The file didn't arrive in storage. Try again." };

  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id: documentId }, data: { uploadedAt: new Date() } });
    // An uploaded memo is also a memo version (continuing the per-venture numbering).
    if (doc.category === "MEMO") {
      const latest = await tx.memoVersion.findFirst({ where: { ventureId: doc.ventureId }, orderBy: { version: "desc" } });
      await tx.memoVersion.create({
        data: {
          ventureId: doc.ventureId,
          version: (latest?.version ?? 0) + 1,
          kind: "UPLOADED_FILE",
          documentId,
          summary: doc.note ?? doc.fileName,
          createdById: user.id,
        },
      });
    }
  });
  revalidatePath(`/deals/${doc.ventureId}`);
  return { ok: true };
}

/** Hide a mistaken upload. The file and record are kept (nothing is deleted). */
export async function archiveDocument(documentId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { memoVersion: { select: { id: true } } } });
  if (!doc) return { error: "Document not found." };
  if (doc.memoVersion) return { error: "This file is a memo version, which is kept as part of the memo history." };
  await db.document.update({ where: { id: documentId }, data: { archivedAt: new Date(), archivedById: user.id } });
  revalidatePath(`/deals/${doc.ventureId}`);
  return { ok: true };
}
