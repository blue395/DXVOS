"use server";

// Which round members see on their deals board. Append-only (MemberRound): the latest row counts.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";

export async function setMemberRound(round: number | null): Promise<ActionResult> {
  const user = await requireAdmin();
  if (round !== null && (!Number.isInteger(round) || round < 1 || round > 99)) return { error: "Choose a round." };
  await db.memberRound.create({ data: { round, byId: user.id } });
  revalidatePath("/");
  revalidatePath("/portal");
  revalidatePath("/portal/deals");
  return { ok: true };
}
