import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { formatWhen } from "@/components/portal/member-deal-parts";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_EVENT_KIND_LABELS, upcomingEvents } from "@/lib/pipeline";
import { createMemberEvent, setMemberEventArchived, updateMemberEvent } from "./actions";
import { EventForm } from "./event-form";

export const metadata = { title: "Members' events · DXV OS" };

// Pitch sessions and community events: the next ones show on every member's home page.
export default async function MemberEventsPage() {
  const events = await requireAdminWith(() =>
    db.memberEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 100,
      include: { createdBy: { select: { name: true } }, updatedBy: { select: { name: true } } },
    }),
  );
  const now = new Date();
  const upcoming = upcomingEvents(events, now);
  const past = events.filter((e) => !upcoming.includes(e));
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Members&apos; events</h1>
          <p className="text-sm text-black/60">
            Pitch sessions and community events. The next ones show on members&apos; home page, with a button to book on Luma.
          </p>
        </div>
      </div>

      <Reveal label="+ Add event" variant="accent">
        <Card title="New event">
          <EventForm action={createMemberEvent} submitLabel="Add event" />
        </Card>
      </Reveal>

      <Card title="Coming up">
        {upcoming.length === 0 ? (
          <p className="text-sm text-black/55">Nothing scheduled. Members see &quot;No session scheduled yet.&quot;</p>
        ) : (
          <ul className="divide-y divide-black/10">
            {upcoming.map((e, i) => (
              <EventRow key={e.id} e={e} note={i === 0 ? "Shown first to members" : undefined} />
            ))}
          </ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card title="Past and archived" collapse={{ open: false, summary: `${past.length} event${past.length === 1 ? "" : "s"}` }}>
          <ul className="divide-y divide-black/10">
            {past.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type Row = Awaited<
  ReturnType<typeof db.memberEvent.findMany<{ include: { createdBy: { select: { name: true } }; updatedBy: { select: { name: true } } } }>>
>[number];

function EventRow({ e, note }: { e: Row; note?: string }) {
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {e.title}
            <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-dxv-green/10 px-2 py-0.5 text-xs font-medium text-dxv-green">
              {MEMBER_EVENT_KIND_LABELS[e.kind]}
            </span>
            {e.archivedAt && <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium">Archived</span>}
            {note && <span className="ml-2 text-xs font-normal text-black/50">{note}</span>}
          </p>
          <p className="text-black/70">
            {formatWhen(e.startsAt, { year: true })} · {e.location}
          </p>
          {e.lumaUrl ? (
            <a href={e.lumaUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-dxv-green underline">
              {e.lumaUrl}
            </a>
          ) : (
            <p className="text-xs text-black/50">No booking link yet</p>
          )}
          <p className="text-xs text-black/45">
            Added by {e.createdBy.name}
            {e.updatedBy ? `, last changed by ${e.updatedBy.name}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <Reveal label="Edit">
          <EventForm action={updateMemberEvent.bind(null, e.id)} event={e} submitLabel="Save changes" />
        </Reveal>
        {e.archivedAt ? (
          <ActionButton run={setMemberEventArchived.bind(null, e.id, false)} variant="secondary" pendingLabel="Restoring…">
            Restore
          </ActionButton>
        ) : (
          <ActionButton
            run={setMemberEventArchived.bind(null, e.id, true)}
            variant="secondary"
            pendingLabel="Archiving…"
            confirm="Hide this event from members?"
          >
            Archive
          </ActionButton>
        )}
      </div>
    </li>
  );
}
