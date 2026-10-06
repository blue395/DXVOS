"use server";

import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { sendFounderDigest } from "@/lib/founder-submissions";
import { mailConfigured } from "@/lib/mail";
import { revalidatePath } from "next/cache";

/** Send the partners' founder-submissions digest now (normally it goes each morning). */
export async function sendDigestNow(): Promise<ActionResult> {
  await requireAdmin();
  if (!mailConfigured()) return { error: "Email isn't set up." };
  const r = await sendFounderDigest();
  revalidatePath("/deals/submissions");
  return r.submissions === 0 ? { error: "No new submissions since the last digest, so nothing was sent." } : { ok: true };
}
