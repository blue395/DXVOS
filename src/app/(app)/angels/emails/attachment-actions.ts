"use server";

// Attachments for an email to angels (or to founders: Deals → Email founders), added in the composer before sending. Uploads go
// from the browser straight to storage (never through the hosting's request limit); an
// approved opportunities pack is rendered to PDF and stored the same way. Until the email
// is sent they're drafts that only their uploader can use.

import { randomUUID } from "node:crypto";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUploadTargetIn, objectExists, objectPath, uploadObject, type UploadTarget } from "@/lib/deck-storage";
import { checkAttachment, EMAIL_ATTACHMENTS_BUCKET, MAX_ATTACHMENTS } from "@/lib/email-attachments";
import { opportunityPackPdf } from "@/lib/opportunity-packs";

export type DraftAttachment = { id: string; fileName: string; sizeBytes: number; pack: boolean };

async function myDrafts(userId: string) {
  return db.memberEmailAttachment.findMany({
    where: { createdById: userId, memberEmailId: null, founderBulkEmailId: null, uploadedAt: { not: null } },
    select: { id: true, sizeBytes: true },
  });
}

export async function startAttachmentUpload(input: {
  fileName: string;
  fileSize: number;
  current: string[];
}): Promise<{ error: string } | { id: string; target: UploadTarget }> {
  const me = await requireAdmin();
  const mine = (await myDrafts(me.id)).filter((a) => input.current.includes(a.id));
  if (mine.length >= MAX_ATTACHMENTS) return { error: `Up to ${MAX_ATTACHMENTS} attachments per email.` };
  const check = checkAttachment(
    String(input.fileName).slice(0, 255),
    Number(input.fileSize),
    mine.reduce((n, a) => n + a.sizeBytes, 0),
  );
  if ("error" in check) return check;
  const id = randomUUID();
  const storagePath = objectPath(id, input.fileName, "pdf", "attachment");
  await db.memberEmailAttachment.create({
    data: {
      id,
      fileName: input.fileName.slice(0, 255),
      mimeType: check.mimeType,
      sizeBytes: input.fileSize,
      bucket: EMAIL_ATTACHMENTS_BUCKET,
      storagePath,
      createdById: me.id,
    },
  });
  try {
    return { id, target: await createUploadTargetIn(EMAIL_ATTACHMENTS_BUCKET, storagePath, `/api/dev/email-attachment-upload/${id}`) };
  } catch {
    return { error: "Couldn't prepare the upload. Try again." };
  }
}

export async function confirmAttachmentUpload(id: string): Promise<{ error: string } | DraftAttachment> {
  const me = await requireAdmin();
  const a = await db.memberEmailAttachment.findFirst({ where: { id, createdById: me.id, memberEmailId: null, founderBulkEmailId: null } });
  if (!a) return { error: "Upload not found. Try again." };
  if (!(await objectExists(a.bucket, a.storagePath))) return { error: "The file didn't finish uploading. Try again." };
  await db.memberEmailAttachment.update({ where: { id }, data: { uploadedAt: new Date() } });
  return { id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, pack: false };
}

/** Attach an approved opportunities pack as a PDF (only approved packs can go to members). */
export async function attachOpportunityPack(packId: string, current: string[]): Promise<{ error: string } | DraftAttachment> {
  const me = await requireAdmin();
  const pdf = await opportunityPackPdf(packId, { approvedOnly: true });
  if (!pdf) return { error: "Only an approved opportunities pack can be attached." };
  const mine = (await myDrafts(me.id)).filter((a) => current.includes(a.id));
  if (mine.length >= MAX_ATTACHMENTS) return { error: `Up to ${MAX_ATTACHMENTS} attachments per email.` };
  const check = checkAttachment(
    pdf.fileName,
    pdf.bytes.length,
    mine.reduce((n, a) => n + a.sizeBytes, 0),
  );
  if ("error" in check) return check;
  const id = randomUUID();
  const storagePath = objectPath(id, pdf.fileName, "pdf", "pack");
  const bytes = Buffer.from(pdf.bytes);
  await uploadObject(EMAIL_ATTACHMENTS_BUCKET, storagePath, bytes, "application/pdf");
  await db.memberEmailAttachment.create({
    data: {
      id,
      fileName: pdf.fileName,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      bucket: EMAIL_ATTACHMENTS_BUCKET,
      storagePath,
      uploadedAt: new Date(),
      opportunityPackId: packId,
      createdById: me.id,
    },
  });
  return { id, fileName: pdf.fileName, sizeBytes: bytes.length, pack: true };
}

/** Take a draft attachment off (never one on a sent email). */
export async function removeDraftAttachment(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  await db.memberEmailAttachment.deleteMany({ where: { id, createdById: me.id, memberEmailId: null, founderBulkEmailId: null } });
  return { ok: true };
}
