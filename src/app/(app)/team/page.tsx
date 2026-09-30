import Link from "next/link";
import { Card, formatDate, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccessButton, CancelInviteButton, InviteForm, ResetLinkButton } from "./team-client";

export const metadata = { title: "Team · DXV OS" };

/** DXV team logins: everyone here has the same access to DXV OS. */
export default async function TeamPage() {
  const me = await requireAdmin();
  const now = new Date();
  const [team, pending, events] = await Promise.all([
    db.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ disabledAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      include: { angel: { select: { id: true, name: true } } },
    }),
    db.teamInvite.findMany({
      where: { kind: "INVITE", usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    db.teamEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Team</h1>
        <p className="text-sm text-black/60">
          DXV partners&apos; logins. Everyone on the team has the same access: every deal, angel and document, the Playbook, approving investor
          statements, and this page. Partners who are also angels use one login for both: the team app, plus their own member portal (where
          deals follow the same investor-statement rules as every member). Each person&apos;s DXV Brain chats are private to them, and everything anyone changes is recorded under their name.
          Technical access (code, hosting, database, AI keys) is separate and isn&apos;t part of DXV OS.
        </p>
      </div>

      <Card title={`Team members (${team.filter((u) => !u.disabledAt).length})`}>
        <ul className="divide-y divide-black/10">
          {team.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className={u.disabledAt ? "text-black/45" : ""}>
                <p className="font-medium">
                  {u.name}
                  {u.id === me.id && <span className="ml-2 rounded bg-dxv-yellow px-1.5 text-xs font-medium text-dxv-green">You</span>}
                  {u.disabledAt && <span className="ml-2 rounded bg-black px-1.5 text-xs font-medium text-white">Access revoked {formatDate(u.disabledAt)}</span>}
                </p>
                <p className="text-black/60">{u.email}</p>
                <p className="text-xs">
                  {u.angel ? (
                    <>
                      Also a member:{" "}
                      <Link href={`/angels/${u.angel.id}`} className="font-medium text-dxv-green underline">
                        {u.angel.name}
                      </Link>{" "}
                      (uses the member portal with this login)
                    </>
                  ) : (
                    <span className="text-black/50">Team only. To make them a member too, open their angel page and use Link to a team login.</span>
                  )}
                </p>
                <p className="text-xs text-black/50">
                  {u.lastSignInAt ? `Last signed in ${formatDateTime(u.lastSignInAt)}` : "Not signed in yet"} · on the team since {formatDate(u.createdAt)}
                </p>
              </div>
              {u.id !== me.id && (
                <div className="flex flex-wrap items-start gap-2">
                  {!u.disabledAt && <ResetLinkButton userId={u.id} />}
                  <AccessButton userId={u.id} name={u.name} enabled={!!u.disabledAt} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Invite a partner">
        <p className="mb-3 text-sm text-black/65">
          Creates a one-time link (valid 14 days) for you to send them. They choose their own password; nobody else ever sees it.
        </p>
        <InviteForm />
        {pending.length > 0 && (
          <div className="mt-4 border-t border-black/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Waiting to be used</p>
            <ul className="mt-1 divide-y divide-black/10">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {i.name} · {i.email}
                    <span className="block text-xs text-black/50">
                      Made by {i.createdBy.name} {formatDateTime(i.createdAt)} · expires {formatDate(i.expiresAt)}
                    </span>
                  </span>
                  <CancelInviteButton inviteId={i.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Access history">
        {events.length === 0 ? (
          <p className="text-sm text-black/55">No changes yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-xs text-black/50">{formatDateTime(e.createdAt)}</span> · {e.actor.name}: {EVENT_LABELS[e.kind] ?? e.kind} ({e.email})
                {e.detail && <span className="text-black/55"> · {e.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  invited: "created an invite link",
  joined: "set up their login",
  "reset-link": "created a password reset link",
  "password-reset": "set a new password",
  "link-cancelled": "cancelled a link",
  "access-revoked": "revoked access",
  "access-restored": "restored access",
  "member-given-team-access": "gave a member login team access",
  "member-linked": "linked a team login to an angel record",
};
