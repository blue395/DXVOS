"use server";

// The team's deal-room controls: share a deal with members (or stop), the summary they
// read, and from which phase each document is visible. Every change is logged in
// DealShareLog (append-only).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ANGEL_DOC_PHASE_LABELS } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";

function revalidateRoom(ventureId: string) {
  revalidatePath(`/deals/${ventureId}`);
  revalidatePath(`/portal/deals/${ventureId}`);
  revalidatePath("/portal");
}

export async function setDealShared(ventureId: string, shared: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  const v = await db.venture.findUnique({ where: { id: ventureId }, select: { sharedWithAngelsAt: true } });
  if (!v) return { error: "Deal not found." };
  if (!!v.sharedWithAngelsAt === shared) return { ok: true };
  await db.$transaction([
    db.venture.update({ where: { id: ventureId }, data: { sharedWithAngelsAt: shared ? new Date() : null } }),
    db.dealShareLog.create({ data: { ventureId, action: shared ? "shared" : "unshared", byId: user.id } }),
  ]);
  revalidateRoom(ventureId);
  return { ok: true };
}

export async function setAngelSummary(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z.string().trim().max(4000, "Keep the summary under 4,000 characters").safeParse(String(formData.get("angelSummary") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the summary." };
  await db.$transaction([
    db.venture.update({ where: { id: ventureId }, data: { angelSummary: parsed.data || null } }),
    db.dealShareLog.create({ data: { ventureId, action: "summary", detail: parsed.data ? "Summary updated" : "Summary cleared", byId: user.id } }),
  ]);
  revalidateRoom(ventureId);
  return { ok: true };
}

export async function setDocumentAngelVisibility(documentId: string, phase: "" | "POST_PITCH" | "COMMITMENTS"): Promise<ActionResult> {
  const user = await requireAdmin();
  const value = z.enum(["", "POST_PITCH", "COMMITMENTS"]).parse(phase) || null;
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { ventureId: true, fileName: true, archivedAt: true, ddReportJob: { select: { id: true } } } });
  if (!doc || doc.archivedAt) return { error: "This document no longer exists." };
  if (value && doc.ddReportJob) return { error: "AI-generated DD reports stay with the team." };
  await db.$transaction([
    db.document.update({ where: { id: documentId }, data: { angelVisibleFrom: value } }),
    db.dealShareLog.create({
      data: { ventureId: doc.ventureId, action: "document", detail: `${doc.fileName}: ${value ? ANGEL_DOC_PHASE_LABELS[value] : "hidden from members"}`, byId: user.id },
    }),
  ]);
  revalidateRoom(doc.ventureId);
  return { ok: true };
}
