"use server";

// Public (no login): asking to join DXV through a shareable sign-up link, confirming the
// email, and (instant links) setting up with Google or Microsoft. All the checks live in
// src/lib/join-links.ts; this only passes the IP along.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { OAuthProvider } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { clientIp } from "@/lib/client-ip";
import { confirmJoinEmail, loadJoinLink, LINK_STATE_MESSAGE, requestToJoin } from "@/lib/join-links";
import { beginOAuth, enabledProviders, PROVIDER_LABEL } from "@/lib/oauth";

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
  // Instant links: straight to setting up their login (member terms, 18+, password or Google).
  if (out.outcome === "setup") redirect(`/join/${out.inviteToken}`);
  redirect(`/join/open/confirm/${encodeURIComponent(token)}?done=${out.outcome === "confirmed" ? "1" : "0"}`);
}

/** Instant links: "Continue with Google / Microsoft" (after ticking the member terms and 18+ here). */
export async function startInstantJoin(token: string, provider: OAuthProvider, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (formData.get("terms") !== "on") return { error: "Please read and accept the member terms first." };
  if (formData.get("adult") !== "on") return { error: "Please confirm you're 18 or over: DXV is for adults only." };
  const link = await loadJoinLink(String(token));
  if (!link || !link.instant) return { error: "This sign-up link doesn't work. Ask the DXV team for a new one." };
  if (link.state !== "open") return { error: LINK_STATE_MESSAGE[link.state] };
  if (!enabledProviders().includes(provider)) return { error: `${PROVIDER_LABEL[provider]} sign-in isn't available just now. Use your email instead.` };
  redirect(await beginOAuth(provider, { kind: "join-link", linkId: link.id }));
}
