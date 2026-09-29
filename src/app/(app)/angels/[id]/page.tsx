import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, formatDate, formatDateTime, inputClass, StageBadge } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  angelTotals,
  canSeeLiveDeals,
  CERTIFICATION_LABELS,
  certState,
  formatGbp,
  latestCertification,
  normaliseAngelName,
  PORTAL_STATE_LABELS,
  portalState,
} from "@/lib/pipeline";
import { addAngelNote, updateAngel } from "../actions";
import { complianceReady } from "@/lib/compliance";
import { AccessButton, PortalLinkButton } from "./portal-client";
import { AngelFields } from "../angel-fields";
import { AngelStatusBadge, CertBadge, Chips } from "../badges";
import { ArchiveAngelButton, CertificationForm, UnlinkAliasButton } from "./angel-client";

export default async function AngelPage({ params }: PageProps<"/angels/[id]">) {
  const { id } = await params;
  const venture = { select: { id: true, name: true, currentStage: true } } as const;

  const [angel, eois, preVotes, finals, ready] = await requireAdminWith(() =>
    Promise.all([
      db.angel.findUnique({
        where: { id },
        include: {
          certifications: {
            orderBy: { signedOn: "desc" },
            include: { recordedBy: { select: { name: true } }, complianceText: { select: { version: true } } },
          },
          user: { select: { id: true, disabledAt: true, lastSignInAt: true } },
          invites: { orderBy: { createdAt: "desc" }, take: 1 },
          events: { orderBy: { createdAt: "desc" }, take: 30 },
          notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
          aliases: { orderBy: { createdAt: "asc" }, include: { confirmedBy: { select: { name: true } } } },
          createdBy: { select: { name: true } },
        },
      }),
      // Picked for this angel, or typed names (filtered below by this angel's aliases).
      db.investmentVote.findMany({ where: { removedAt: null, OR: [{ angelId: id }, { angelId: null }] }, orderBy: { createdAt: "desc" }, include: { venture } }),
      db.preSelectionVote.findMany({ where: { OR: [{ angelId: id }, { angelId: null }] }, orderBy: { createdAt: "desc" }, include: { venture } }),
      db.finalInvestment.findMany({ where: { removedAt: null, OR: [{ angelId: id }, { angelId: null }] }, orderBy: { createdAt: "desc" }, include: { venture } }),
      complianceReady(),
    ]),
  );
  if (!angel) notFound();

  const names = new Set(angel.aliases.map((a) => a.normalized));
  const mine = <T extends { angelId: string | null; angelName: string }>(rows: T[]) => rows.filter((r) => r.angelId === id || (!r.angelId && names.has(normaliseAngelName(r.angelName))));
  const myEois = mine(eois);
  const myPre = mine(preVotes);
  const myFinals = mine(finals);
  const totals = angelTotals(myEois, myFinals);

  const latest = latestCertification(angel.certifications);
  const state = certState(latest);
  const member = angel.status === "MEMBER";
  const gateOpen = canSeeLiveDeals(angel, latest);
  const portal = portalState(angel, angel.user, angel.invites[0] ?? null);

  return (
    <div className="space-y-5">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-dxv-green">
            {angel.name}
            <AngelStatusBadge status={angel.status} />
            {angel.archivedAt && <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white">Archived</span>}
          </h1>
          <p className="text-sm text-black/60">
            {[angel.email, angel.phone, angel.location].filter(Boolean).join(" · ") || "No contact details yet"}
            {angel.linkedinUrl && (
              <>
                {" · "}
                <a href={angel.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline">
                  LinkedIn
                </a>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CertBadge state={state} expiresOn={latest?.expiresOn} member={member} />
            <Chips items={angel.tags} className="bg-dxv-yellow/40 text-black/80" />
          </div>
        </div>
        <ArchiveAngelButton angelId={angel.id} archived={!!angel.archivedAt} />
      </header>

      {member && (state === "overdue" || state === "none") && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/30 px-3 py-2 text-sm">
          <strong>{state === "none" ? "No investor statement on record." : `Statement expired ${formatDate(latest!.expiresOn)}.`}</strong> DXV can&apos;t send
          this member deal promotions until they sign a new high net worth or sophisticated investor statement. Record it below once signed.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card title="Investor certification">
            <div className="space-y-4">
              {angel.certifications.length === 0 ? (
                <p className="text-sm text-black/60">No signed statement recorded yet.</p>
              ) : (
                <ul className="divide-y divide-black/5 text-sm">
                  {angel.certifications.map((c, i) => (
                    <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span>
                        <strong>{CERTIFICATION_LABELS[c.type]}</strong>
                        {i === 0 && <span className="ml-1.5 rounded-full bg-dxv-green/10 px-1.5 text-[10px] font-semibold uppercase text-dxv-green">Counts</span>}
                        <span className="block text-xs text-black/55">
                          Signed {formatDate(c.signedOn)} · valid to {formatDate(c.expiresOn)} ·{" "}
                          {c.signedByAngel ? `signed by the angel in the portal ("${c.signatureName}", wording v${c.complianceText?.version ?? "?"})` : `recorded by ${c.recordedBy.name}`}
                          {c.note && !c.signedByAngel && ` · ${c.note}`}
                        </span>
                        {c.signedByAngel && c.criteria.length > 0 && (
                          <span className="mt-0.5 block text-xs text-black/50">Criteria ticked: {c.criteria.map((x) => x.split(".")[0]).join("; ")}</span>
                        )}
                      </span>
                      {c.fileName && (
                        <a href={`/api/angels/certifications/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-dxv-green underline">
                          {c.fileName}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Reveal label="+ Record a signed statement">
                <CertificationForm angelId={angel.id} />
              </Reveal>
              <p className="text-xs text-black/50">
                Once angels log in, only members with a current statement will see live deal terms and vote. {angel.name}:{" "}
                <strong className="text-black/70">{gateOpen ? "would have access" : "would not have access"}</strong>.
              </p>
            </div>
          </Card>

          <Card title="Investments">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Total label="Committed (EOIs)" value={formatGbp(totals.committedGbp)} />
                <Total label="Invested (paid)" value={formatGbp(totals.investedGbp)} strong />
                <Total label="Deals committed to" value={String(totals.deals)} />
              </div>
              <Section title="Final investments" empty="None yet.">
                {myFinals.map((f) => (
                  <Row key={f.id} venture={f.venture} right={`${formatGbp(f.ticketGbp)} · ${f.paidAt ? `paid ${formatDate(f.paidAt)}` : "not yet paid"}`} />
                ))}
              </Section>
              <Section title="EOIs" empty="None yet.">
                {myEois.map((e) => (
                  <Row key={e.id} venture={e.venture} right={`${e.interested ? `up to ${formatGbp(e.maxTicketGbp)}` : "not interested"} · ${formatDate(e.createdAt)}`} />
                ))}
              </Section>
              <Section title="Pre-selection votes" empty="None yet.">
                {myPre.map((p) => (
                  <Row key={p.id} venture={p.venture} right={`${p.interested ? "interested" : "not interested"} · ${formatDate(p.createdAt)}`} />
                ))}
              </Section>
            </div>
          </Card>

          <Card title="Notes">
            <div className="space-y-3">
              <ActionForm action={addAngelNote.bind(null, angel.id)} className="space-y-2">
                <textarea name="body" rows={2} placeholder="Add a note about this angel…" className={inputClass} />
                <SubmitButton pendingLabel="Adding…" doneLabel="Added">
                  Add note
                </SubmitButton>
              </ActionForm>
              {angel.notes.length === 0 ? (
                <p className="text-sm text-black/55">No notes yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {angel.notes.map((n) => (
                    <li key={n.id} className="rounded-md bg-black/[0.03] px-3 py-2">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-xs text-black/45">
                        {n.author.name} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Portal access">
            <div className="space-y-3 text-sm">
              <p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${portal === "active" ? "bg-dxv-green text-white" : portal === "revoked" ? "bg-black text-white" : "bg-black/5 text-black/70"}`}>
                  {PORTAL_STATE_LABELS[portal]}
                </span>
                {angel.user?.lastSignInAt && <span className="ml-2 text-xs text-black/50">last signed in {formatDate(angel.user.lastSignInAt)}</span>}
              </p>
              {!ready.ready && (
                <p className="rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
                  Invites are paused until the investor statements and member terms are approved.{" "}
                  <Link href="/angels/statements" className="font-medium underline">
                    Review them
                  </Link>
                </p>
              )}
              {!angel.user && ready.ready && (
                <PortalLinkButton angelId={angel.id} kind="INVITE" label={portal === "invited" ? "Make a new invite link" : "Create invite link"} />
              )}
              {angel.user && !angel.user.disabledAt && <PortalLinkButton angelId={angel.id} kind="RESET" label="Password reset link" />}
              {angel.user && <AccessButton angelId={angel.id} enabled={!!angel.user.disabledAt} />}
              <Link href={`/angels/${angel.id}/preview`} className="block text-xs font-medium text-dxv-green underline">
                Preview their portal
              </Link>
              {angel.events.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-black/60">Portal activity ({angel.events.length})</summary>
                  <ul className="mt-1 space-y-0.5 text-black/60">
                    {angel.events.map((e) => (
                      <li key={e.id}>
                        {formatDateTime(e.createdAt)}: {e.kind.replace(/-/g, " ")}
                        {e.detail && ` (${e.detail})`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </Card>

          <Card title="Profile">
            <dl className="space-y-2.5 text-sm">
              <Item label="Sectors">{angel.sectors.length ? <Chips items={angel.sectors} /> : "–"}</Item>
              <Item label="WhatsApp groups">{angel.whatsappGroups.length ? <Chips items={angel.whatsappGroups} className="bg-black/5 text-black/75" /> : "–"}</Item>
              <Item label="Member since">{angel.joinedAt ? formatDate(angel.joinedAt) : "–"}</Item>
              <Item label="Came to DXV via">{angel.source ?? "–"}</Item>
              <Item label="Typical cheque">{angel.ticketRange ?? "–"}</Item>
              <Item label="Experience">{angel.experience ?? "–"}</Item>
              {angel.bio && <Item label="Bio">{angel.bio}</Item>}
              <Item label="Added">
                {formatDate(angel.createdAt)} by {angel.createdBy.name}
              </Item>
            </dl>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-dxv-green hover:underline">Edit details</summary>
              <ActionForm action={updateAngel.bind(null, angel.id)} resetOnSuccess={false} className="mt-3 space-y-3">
                <AngelFields v={angel} />
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </details>
          </Card>

          <Card title="Names on votes">
            {angel.aliases.length === 0 ? (
              <p className="text-sm text-black/55">
                No typed names linked. <Link href="/angels/link" className="text-dxv-green underline">Link names</Link> from older votes to this angel.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {angel.aliases.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>
                      &ldquo;{a.normalized}&rdquo;
                      <span className="block text-xs text-black/45">confirmed by {a.confirmedBy.name}</span>
                    </span>
                    <UnlinkAliasButton aliasId={a.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-dxv-green/[0.04] px-2 py-2">
      <p className="text-[11px] uppercase tracking-wide text-black/55">{label}</p>
      <p className={`font-mono tabular-nums ${strong ? "font-semibold text-dxv-green" : ""}`}>{value}</p>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/55">{title}</h3>
      {children.length ? <ul className="divide-y divide-black/5">{children}</ul> : <p className="text-black/50">{empty}</p>}
    </div>
  );
}

function Row({ venture, right }: { venture: { id: string; name: string; currentStage: Parameters<typeof StageBadge>[0]["stage"] }; right: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="flex items-center gap-2">
        <Link href={`/deals/${venture.id}`} className="font-medium hover:text-dxv-green hover:underline">
          {venture.name}
        </Link>
        <StageBadge stage={venture.currentStage} />
      </span>
      <span className="text-xs text-black/60">{right}</span>
    </li>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-black/50">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
