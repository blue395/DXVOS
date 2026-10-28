"use server";

// Pitch sessions and community events members see on their home page. Any partner can add
// and edit them; they're archived, never deleted.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";
import { londonLocalToDate, lumaLink } from "@/lib/pipeline";

const EventSchema = z.object({
  kind: z.enum(["PITCH_SESSION", "COMMUNITY"], { message: "Choose the type of event" }),
  title: z.string().trim().min(2, "Give the event a name").max(120),
  startsAt: z
    .string()
    .transform((s) => londonLocalToDate(s))
    .refine((d): d is Date => d !== null, "Enter the date and start time"),
  location: z.string().trim().min(2, 'Say where it is (or "Online")').max(200),
  lumaUrl: z.string().trim().max(500, "That link is too long").optional(),
  details: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => s || null),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." } as const;
  const lumaUrl = parsed.data.lumaUrl ? lumaLink(parsed.data.lumaUrl) : null;
  if (parsed.data.lumaUrl && !lumaUrl) return { error: "The booking link must be a Luma link (https://lu.ma/… or https://luma.com/…)." } as const;
  return { data: { ...parsed.data, lumaUrl } } as const;
}

function revalidateEvents() {
  revalidatePath("/angels/events");
  revalidatePath("/portal");
}

export async function createMemberEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const p = parse(formData);
  if ("error" in p) return { error: p.error };
  await db.memberEvent.create({ data: { ...p.data, createdById: user.id } });
  revalidateEvents();
  return { ok: true };
}

export async function updateMemberEvent(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const p = parse(formData);
  if ("error" in p) return { error: p.error };
  const { count } = await db.memberEvent.updateMany({ where: { id }, data: { ...p.data, updatedById: user.id } });
  if (!count) return { error: "That event no longer exists. Reload the page." };
  revalidateEvents();
  return { ok: true };
}

/** Archive (hide from members) or restore an event. */
export async function setMemberEventArchived(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  await db.memberEvent.updateMany({ where: { id }, data: { archivedAt: archived ? new Date() : null, updatedById: user.id } });
  revalidateEvents();
  return { ok: true };
}
