import "server-only";
// Records which part of the member portal someone opened (for the team's Insights page).
// Never blocks or breaks a page: run it alongside the page's own loading; failures are logged.
import type { PortalViewKind } from "@/generated/prisma/enums";
import { db } from "./db";

export async function trackPortalView(who: { user: { role: string }; angel: { id: string } }, kind: PortalViewKind, ventureId?: string): Promise<void> {
  try {
    await db.portalView.create({ data: { angelId: who.angel.id, kind, ventureId: ventureId ?? null, team: who.user.role === "ADMIN" } });
  } catch (e) {
    console.error("Couldn't record a portal view", e);
  }
}
