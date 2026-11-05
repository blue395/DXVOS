"use server";

// Public (no login): asking to join DXV through a shareable sign-up link, and confirming
// the email. All the checks live in src/lib/join-links.ts; this only passes the IP along.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { clientIp } from "@/lib/client-ip";
import { confirmJoinEmail, requestToJoin } from "@/lib/join-links";

export async function askToJoin(token: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const out = await requestToJoin(
    String(token),
    { name: formData.get("name"), email: formData.get("email"), formToken: formData.get("formToken"), trap: formData.get("website") },
    clientIp(await headers()),
  );
  if ("error" in out) return { error: out.error };
  redirect(`/join/open/${encodeURIComponent(token)}?sent=1`);
}

export async function confirmMyEmail(token: string): Promise<ActionResult> {
  const out = await confirmJoinEmail(String(token));
  redirect(`/join/open/confirm/${encodeURIComponent(token)}?done=${out === "confirmed" ? "1" : "0"}`);
}
