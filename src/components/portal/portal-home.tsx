// The angel's portal home, as a plain view of their data, so admins can preview it
// ("Preview as angel") exactly as the angel sees it. Server-component safe.
import Link from "next/link";
import { buttonClass, formatDate } from "@/components/ui";
import { CERTIFICATION_LABELS, certState, canSeeLiveDeals, formatGbp, type CertLike } from "@/lib/pipeline";
import type { AngelStatus, CertificationType } from "@/generated/prisma/enums";
import type { DealListItem } from "@/lib/portal-deals";
import { PhaseBadge } from "./deal-room";

export type PortalAngel = {
  name: string;
  email: string | null;
  status: AngelStatus;
  archivedAt: Date | null;
  sectors: string[];
  ticketRange: string | null;
  experience: string | null;
  location: string | null;
  restrictedDeclaredAt: Date | null;
};

export function PortalHome({
  angel,
  cert,
  deals,
  dealHref = (id) => `/portal/deals/${id}`,
  deckHref = (id, download) => `/api/portal/documents/${id}${download ? "?download=1" : ""}`,
  boardRound = null,
  boardHref = "/portal/deals",
  preview = false,
}: {
  angel: PortalAngel;
  cert: (CertLike & { type: CertificationType }) | null;
  /** The deals shared with members (only passed when this angel may see deals). */
  deals: DealListItem[];
  dealHref?: (id: string) => string;
  /** Where a pitch deck opens (the members' document route; the team's preview uses its own). */
  deckHref?: (documentId: string, download?: boolean) => string;
  /** The round open on the members' deals board (null: none). */
  boardRound?: number | null;
  /** Where the board link goes (null hides it, e.g. in the team's preview). */
  boardHref?: string | null;
  preview?: boolean;
}) {
  const state = certState(cert);
  const access = canSeeLiveDeals(angel, cert) && !angel.restrictedDeclaredAt;
  const first = angel.name.split(" ")[0];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Hello {first}</h1>
        <p className="text-sm text-black/60">Your DXV member home.</p>
      </div>

      <DealsPanel access={access} deals={deals} dealHref={dealHref} deckHref={deckHref} boardRound={boardRound} boardHref={boardHref} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your investor statement</h2>
          {cert && (state === "current" || state === "due-soon") ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                <strong>{CERTIFICATION_LABELS[cert.type]}</strong>, signed {formatDate(cert.signedOn)}.
              </p>
              <p className={state === "due-soon" ? "rounded bg-dxv-yellow/40 px-2 py-1" : "text-black/65"}>
                {state === "due-soon" ? "Expires soon: " : "Valid until "}
                {formatDate(cert.expiresOn)}.{state === "due-soon" && " Renew it to keep seeing deals."}
              </p>
              {state === "due-soon" && !preview && (
                <Link href="/portal/certify" className={buttonClass()}>
                  Renew my statement
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <p className="rounded bg-dxv-yellow/40 px-2 py-1">
                {angel.restrictedDeclaredAt && !cert
                  ? "You told us neither investor statement applies to you, so we can't share investment opportunities with you. You're still part of the DXV community."
                  : cert
                    ? `Your statement expired on ${formatDate(cert.expiresOn)}. Sign a new one to see deals again.`
                    : "You haven't signed an investor statement yet."}
              </p>
              {!preview && (
                <Link href="/portal/certify" className={buttonClass()}>
                  {angel.restrictedDeclaredAt && !cert ? "My circumstances have changed" : "Sign my statement"}
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Your profile</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Email" value={angel.email} />
            <Row label="Location" value={angel.location} />
            <Row label="Interested in" value={angel.sectors.join(", ")} />
            <Row label="Typical cheque" value={angel.ticketRange} />
            <Row label="Experience" value={angel.experience} />
          </dl>
          {!preview && (
            <Link href="/portal/profile" className="mt-3 inline-block text-sm font-medium text-dxv-green underline">
              Update my details
            </Link>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">How DXV works</h2>
          <VideoSlot />
        </section>
      </div>
    </div>
  );
}

/** The member home's headline: the deals open to this member, what each needs from them, and the round board. */
function DealsPanel({
  access,
  deals,
  dealHref,
  deckHref,
  boardRound,
  boardHref,
}: {
  access: boolean;
  deals: DealListItem[];
  dealHref: (id: string) => string;
  deckHref: (documentId: string, download?: boolean) => string;
  boardRound: number | null;
  boardHref: string | null;
}) {
  const toVote = deals.filter((d) => d.voteKind && !d.myAnswer).length;
  return (
    <section className="rounded-lg border-2 border-dxv-green bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-dxv-green/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-dxv-green">Deals open to you</h2>
          {access && <span className="rounded-full bg-dxv-green px-2.5 py-0.5 text-sm font-semibold text-white">{deals.length}</span>}
        </div>
        {access && boardRound !== null && boardHref && (
          <Link href={boardHref} className="text-sm font-medium text-dxv-green underline">
            See the Round {boardRound} board →
          </Link>
        )}
      </div>
      <div className="p-4">
        {!access ? (
          <p className="text-sm text-black/65">Deals appear here for members with a current investor statement.</p>
        ) : deals.length === 0 ? (
          <p className="text-sm text-black/65">
            No deals are open to you right now. When DXV opens a deal for members&apos; pitch selection vote, it will appear here with its pitch deck.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-black/65">
              Open a deal to read its pitch deck, DXV&apos;s memo and documents, and record your vote.
              {toVote > 0 && (
                <span className="ml-1 rounded bg-dxv-yellow px-1.5 py-0.5 font-medium text-dxv-green">
                  {toVote} {toVote === 1 ? "deal needs" : "deals need"} your vote
                </span>
              )}
            </p>
            <ul className="space-y-2">
              {deals.map((d) => {
                const needsVote = !!d.voteKind && !d.myAnswer;
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 p-3 transition hover:border-dxv-green hover:bg-dxv-green/[0.03]"
                  >
                    <Link href={dealHref(d.id)} className="group min-w-0 flex-1">
                      <span className="block font-semibold text-dxv-green group-hover:underline">{d.name}</span>
                      {d.oneLiner && <span className="block text-sm text-black/70">{d.oneLiner}</span>}
                      {d.sector && <span className="block text-sm text-black/55">{d.sector}</span>}
                      <span className={`mt-0.5 block text-xs ${needsVote ? "font-medium text-black" : "text-black/60"}`}>{answerLine(d)}</span>
                    </Link>
                    <PhaseBadge phase={d.phase} />
                    <span className="flex flex-wrap items-center gap-2">
                      {d.deck && (
                        <>
                          <a
                            href={deckHref(d.deck.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-dxv-green/40 px-3 py-1.5 text-sm font-medium text-dxv-green transition hover:bg-dxv-green/5"
                            title={`Open ${d.deck.fileName} in a new tab`}
                          >
                            View deck
                          </a>
                          <a
                            href={deckHref(d.deck.id, true)}
                            className="rounded-md px-2 py-1.5 text-sm text-dxv-green underline transition hover:bg-dxv-green/5"
                            title={`Download ${d.deck.fileName}`}
                          >
                            Download
                          </a>
                        </>
                      )}
                      <Link href={dealHref(d.id)} className={buttonClass()}>
                        View deal →
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function answerLine(d: DealListItem): string {
  if (!d.voteKind) return "Read the documents";
  if (!d.myAnswer) return d.voteKind === "pre-selection" ? "Should they pitch? Your vote is needed" : "Would you invest? Your investment vote is needed";
  if (d.voteKind === "pre-selection") return d.myAnswer.interested ? "✓ You voted: yes, hear their pitch" : "✓ You voted: not for me";
  return d.myAnswer.interested ? `✓ You voted: interested, up to ${formatGbp(d.myAnswer.maxTicketGbp ?? 0)}` : "✓ You voted: not investing";
}

/** Where the how-to video goes (added later). */
export function VideoSlot() {
  return (
    <div className="mt-2 flex aspect-video items-center justify-center rounded-md bg-dxv-green/[0.06] text-center text-sm text-black/55 ring-1 ring-dxv-green/15">
      <span>
        <span className="block text-2xl text-dxv-green" aria-hidden>
          ▶
        </span>
        A short how-to video is coming soon.
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-black/50">{label}</dt>
      <dd>{value || "–"}</dd>
    </div>
  );
}
