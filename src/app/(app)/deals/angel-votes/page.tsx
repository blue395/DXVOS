import Link from "next/link";
import { Card, formatDateTime } from "@/components/ui";
import { angelVotesEmail } from "@/content/angel-votes-email";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { angelVotingState, dateToLondonLocal, latestVotePerAngel, preSelectionVoteCounts, roundOpenedAt } from "@/lib/pipeline";
import { loadVoteRounds } from "@/lib/portal-deals";
import { VotingDeadlineForm } from "../../(home)/voting-deadline-form";
import { loadAudiences } from "../../angels/emails/audience";
import { OpenVotingForm } from "./open-form";

export const metadata = { title: "Open angel votes · DXV OS" };

// Members vote for their top 3 only after DXV has presented the round's opportunities live
// (Blue, 2026-11-06). This page opens that vote for the round open to members and emails them.
export default async function AngelVotesPage() {
  const [rounds, audiences] = await requireAdminWith(() => Promise.all([loadVoteRounds(), loadAudiences()]));
  const round = rounds.current?.round ?? null;
  const openedAt = roundOpenedAt(round, rounds);
  const [deals, opening] = await Promise.all([
    round === null
      ? []
      : db.venture.findMany({
          where: { round, currentStage: "PITCH_SELECTION" },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            sharedWithAngelsAt: true,
            preSelectionVotes: { select: { id: true, angelName: true, interested: true, createdAt: true } },
          },
        }),
    openedAt
      ? db.memberRound.findFirst({ where: { round, votingOpenedAt: openedAt }, orderBy: { createdAt: "asc" }, include: { by: { select: { name: true } } } })
      : null,
  ]);
  const state = angelVotingState(rounds);
  const closesAt = rounds.current?.votingClosesAt ?? null;
  const group = audiences.find((a) => a.key === "deal-access")!;
  const unshared = deals.filter((d) => !d.sharedWithAngelsAt);
  const tally = deals
    .map((d) => {
      const counted = latestVotePerAngel(d.preSelectionVotes.filter((v) => preSelectionVoteCounts(v, round, rounds)));
      return { ...d, yes: counted.filter((v) => v.interested).length, votes: counted.length };
    })
    .sort((a, b) => b.yes - a.yes || a.name.localeCompare(b.name));
  const starter = round !== null && closesAt ? angelVotesEmail(round, closesAt) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <Link href="/deals" className="text-sm text-dxv-green hover:underline">
        ← Deals
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Open angel votes{round !== null && `: Round ${round}`}</h1>
        <p className="text-sm text-black/60">
          Members vote for their top 3 companies to pitch once you&apos;ve presented the round&apos;s investment opportunities live. Until you open voting here,
          they can read the decks and memos but can&apos;t vote.
        </p>
      </div>

      {state === "no-round" ? (
        <Card title="No round open to members">
          <p className="text-sm">
            Choose the round open to members on the{" "}
            <Link href="/" className="text-dxv-green underline">
              Dashboard
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Where voting stands">
            <p className="text-sm">
              {state === "not-open" && (
                <>
                  <strong>Not open yet.</strong> Members see &ldquo;Voting opens after the live pitch session&rdquo;. Any votes cast before you open it
                  won&apos;t count.
                </>
              )}
              {state === "open" && (
                <>
                  <strong>Open</strong> since {formatDateTime(openedAt!)}
                  {opening && ` (opened by ${opening.by.name})`}. {closesAt ? `Closes ${formatDateTime(closesAt)} (UK time).` : "No deadline set."}
                </>
              )}
              {state === "closed" && (
                <>
                  <strong>Closed</strong> {formatDateTime(closesAt!)}. Opened {formatDateTime(openedAt!)}
                  {opening && ` by ${opening.by.name}`}. Set a later deadline below to reopen it.
                </>
              )}
            </p>
            <div className="mt-3 text-sm">
              <VotingDeadlineForm key={rounds.setAt?.toISOString()} current={closesAt ? dateToLondonLocal(closesAt) : ""} />
            </div>
          </Card>

          <Card title={`Round ${round} deals members vote on (${deals.length})`}>
            {deals.length === 0 ? (
              <p className="text-sm text-black/55">No Round {round} deals are at Member Pitch Selection yet.</p>
            ) : (
              <>
                {unshared.length > 0 && (
                  <p className="mb-3 rounded-md bg-dxv-yellow/30 px-3 py-2 text-sm">
                    Not shared with members yet, so they can&apos;t see or vote on: <strong>{unshared.map((d) => d.name).join(", ")}</strong>. Share each from
                    its deal page (Members&apos; deal room) first.
                  </p>
                )}
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-black/50">
                    <tr>
                      <th className="py-1.5 font-medium">Company</th>
                      <th className="py-1.5 font-medium">Shared</th>
                      <th className="py-1.5 text-right font-medium">Yes votes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {tally.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1.5">
                          <Link href={`/deals/${d.id}#pre-selection`} className="hover:text-dxv-green hover:underline">
                            {d.name}
                          </Link>
                        </td>
                        <td className="py-1.5">{d.sharedWithAngelsAt ? "Yes" : <span className="font-medium">Not yet</span>}</td>
                        <td className="py-1.5 text-right tabular-nums">{state === "not-open" ? "–" : `${d.yes} of ${d.votes}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-black/55">Votes count only from when voting opened. Each member&apos;s latest answer per company counts.</p>
              </>
            )}
          </Card>

          {state === "not-open" && (
            <Card title="Open voting">
              {!starter ? (
                <p className="text-sm">Set the voting deadline above first: members need to know when voting closes.</p>
              ) : (
                <OpenVotingForm round={round!} subject={starter.subject} body={starter.body} recipients={group.people.length} canEmail={mailConfigured()} />
              )}
              {group.optedOut + group.noEmail > 0 && (
                <p className="mt-2 text-xs text-black/55">
                  Not emailed: {group.optedOut} unsubscribed, {group.noEmail} without an email address. They can still vote on the platform.
                </p>
              )}
            </Card>
          )}
          {state !== "not-open" && (
            <p className="text-sm text-black/60">
              To send a reminder, write to &ldquo;Members who can see deals&rdquo; from{" "}
              <Link href="/angels/emails/new" className="text-dxv-green underline">
                Angels → Email angels
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
