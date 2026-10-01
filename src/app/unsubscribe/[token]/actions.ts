"use server";

// Public: the signed token in the email's link is the only credential, and it can only
// switch that one angel's bulk emails off or on.
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { setEmailOptOut } from "@/lib/email-optout";
import { angelFromUnsubscribeToken } from "@/lib/unsubscribe";

export async function setMyEmailOptOut(token: string, optOut: boolean): Promise<ActionResult> {
  const angelId = await angelFromUnsubscribeToken(token);
  if (!angelId || !(await setEmailOptOut(angelId, optOut, optOut ? "From the link in an email" : "Subscribed again from the email link"))) {
    return { error: "This link doesn't work. Reply to any DXV email and we'll sort it out." };
  }
  revalidatePath(`/unsubscribe/${token}`);
  return { ok: true };
}
