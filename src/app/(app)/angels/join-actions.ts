"use server";

// Shareable sign-up links (Blue, 2026-11-05): partners make and switch off links, and
// approve or decline the requests that come through them. Rules in src/lib/join-links.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveJoinRequest, declineJoinRequest } from "@/lib/join-links";
import { JOIN_LINK_DAY_OPTIONS } from "@/lib/pipeline";

const LinkSchema = z.object({
  label: z.string().trim().min(2, 'Say where you\'ll share it, e.g. "WhatsApp group, Nov 2026"').max(80),
  days: z.coerce.number().refine((d) => (JOIN_LINK_DAY_OPTIONS as readonly number[]).includes(d), "Choose how long it works"),
  maxUses: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 500), "Uses must be a whole number from 1 to 500, or blank"),
});

export async function createJoinLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = LinkSchema.safeParse({ label: formData.get("label"), days: formData.get("days"), maxUses: String(formData.get("maxUses") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  await db.memberJoinLink.create({
    data: { label: parsed.data.label, expiresAt: new Date(Date.now() + parsed.data.days * 86_400_000), maxUses: parsed.data.maxUses, createdById: me.id },
  });
  revalidatePath("/angels/invite");
  return { ok: true };
}

export async function switchOffJoinLink(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.memberJoinLink.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/angels/invite");
  return { ok: true };
}

export async function approveJoin(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const out = await approveJoinRequest(String(id), me);
  revalidatePath("/angels/invite");
  revalidatePath("/angels");
  if ("error" in out) return { error: out.error };
  // Approved either way; if the email didn't go, the partner can send the link themselves.
  if (out.emailError) return { error: `Approved, but ${out.emailError.charAt(0).toLowerCase()}${out.emailError.slice(1)} Their link: ${out.link}` };
  return { ok: true };
}

export async function declineJoin(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const out = await declineJoinRequest(String(id), me.id);
  revalidatePath("/angels/invite");
  return out;
}
