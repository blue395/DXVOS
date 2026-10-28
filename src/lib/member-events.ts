// Pitch sessions and community events for the member home (added on /angels/events).
import "server-only";
import { db } from "@/lib/db";
import { upcomingEvents } from "@/lib/pipeline";
import type { PortalEvent } from "@/components/portal/portal-home";

/** Upcoming, not archived, soonest first. */
export async function loadMemberEvents(now = new Date()): Promise<PortalEvent[]> {
  const rows = await db.memberEvent.findMany({
    where: { archivedAt: null, startsAt: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 10,
    select: { id: true, kind: true, title: true, startsAt: true, location: true, lumaUrl: true, details: true, archivedAt: true },
  });
  return upcomingEvents(rows, now).map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    startsAt: e.startsAt,
    location: e.location,
    lumaUrl: e.lumaUrl,
    details: e.details,
  }));
}

/** Pitch sessions are where deals are presented: only members who can see deals get them. Community events go to everyone. */
export function eventsFor(events: PortalEvent[], dealAccess: boolean): PortalEvent[] {
  return dealAccess ? events : events.filter((e) => e.kind !== "PITCH_SESSION");
}
