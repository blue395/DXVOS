"use server";

// Reviewing and approving the legal wording angels see. A text's wording never changes
// once saved: editing saves a new draft version, and approving a draft retires the
// previous approved version (kept, since signatures refer to it).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ComplianceTextKind } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";

const DraftSchema = z.object({
  kind: z.enum(ComplianceTextKind),
  title: z.string().trim().min(1, "Give it a title").max(200),
  body: z.string().trim().min(20, "The text looks too short"),
  criteria: z.string().optional(),
  note: z
    .string()
    .trim()
    .transform((s) => s || null)
    .optional(),
});

export async function saveComplianceDraft(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = DraftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { kind, title, body, note } = parsed.data;
  const criteria = (parsed.data.criteria ?? "")
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (kind !== "MEMBER_TERMS" && criteria.length === 0) return { error: "A statement needs at least one qualifying criterion (one per line)." };
  const latest = await db.complianceText.findFirst({ where: { kind }, orderBy: { version: "desc" }, select: { version: true } });
  await db.complianceText.create({
    data: { kind, version: (latest?.version ?? 0) + 1, title, body, criteria, note: note ?? null, createdById: user.id },
  });
  revalidatePath("/angels/statements");
  return { ok: true };
}

export async function approveComplianceText(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const text = await db.complianceText.findUnique({ where: { id } });
  if (!text || text.status !== "DRAFT") return { error: "Only a draft can be approved." };
  await db.$transaction([
    db.complianceText.updateMany({ where: { kind: text.kind, status: "APPROVED" }, data: { status: "RETIRED" } }),
    db.complianceText.update({ where: { id }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() } }),
  ]);
  revalidatePath("/angels/statements");
  revalidatePath("/angels");
  return { ok: true };
}
