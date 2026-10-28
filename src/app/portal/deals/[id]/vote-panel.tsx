// The angel's vote on a shared deal: interest in hearing the pitch (Member Pitch
// Selection), then an expression of interest with a maximum ticket (after the pitch and
// during Investment Commitments). Each answer is a new entry; the latest counts.
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, formatDateTime, inputClass } from "@/components/ui";
import { formatGbp } from "@/lib/pipeline";
import { VotingStatus } from "@/components/portal/member-deal-parts";
import type { DealRoom } from "@/lib/portal-deals";
import { castEoi, castPreSelectionVote } from "../../actions";

export function VotePanel({ deal, now = new Date() }: { deal: DealRoom; now?: Date }) {
  if (!deal.voteKind) return null;
  const pre = deal.voteKind === "pre-selection";
  const voting = pre ? deal.voting : null;
  const closed = !!voting?.closesAt && now >= voting.closesAt;
  // Every vote used on other deals: this one can only be "No" until they free one up.
  const full = !!voting && voting.round !== null && !voting.used.has(deal.id) && voting.used.size >= voting.limit;
  const mine = pre ? deal.myPreSelection : deal.myEoi;
  const answer = mine
    ? pre
      ? mine.interested
        ? "Yes, I'd like to hear them pitch"
        : "No, not for me"
      : mine.interested
        ? `Interested in investing, up to ${formatGbp(deal.myEoi!.maxTicketGbp)}`
        : "Not investing"
    : null;
  return (
    <section className="rounded-lg border-2 border-dxv-yellow bg-dxv-yellow/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">{pre ? "Should they pitch to DXV?" : "Would you like to invest?"}</h2>
      {mine && (
        <p className="mt-1 text-sm">
          Your answer: <strong>{answer}</strong> <span className="text-black/55">({formatDateTime(mine.createdAt)})</span>
          {mine.note && <span className="block text-black/65">“{mine.note}”</span>}
        </p>
      )}
      {pre && (
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-black/75">
            {voting?.round !== null && voting?.round !== undefined
              ? `Vote for your top ${voting.limit} in Round ${voting.round}: the ${voting.limit} companies with the most votes are invited to pitch.`
              : "The companies with the most votes are invited to pitch."}{" "}
            <strong>A vote is not a commitment to invest.</strong>
          </p>
          {voting && (
            <p>
              <VotingStatus voting={voting} now={now} />
            </p>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-black/60">
        {pre
          ? "You can change your vote until voting closes. Only the DXV team sees your answer."
          : "This is an expression of interest, not a commitment: DXV confirms final amounts with you before anything is paid. Only the DXV team sees your answer."}
      </p>
      {closed ? null : (
        <ActionForm action={(pre ? castPreSelectionVote : castEoi).bind(null, deal.id)} className="mt-3 space-y-3">
          {full && (
            <p className="rounded-md bg-dxv-yellow/30 px-3 py-2 text-sm">
              You&apos;ve used all {voting!.limit} of your votes in this round. To vote for this company, change one of your other votes to &quot;No&quot;
              first.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={pre ? "Interested? *" : "Invest? *"}>
              <select name="interested" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choose…
                </option>
                <option value="yes" disabled={full}>
                  {pre ? "Yes, I'd like to hear them pitch" : "Yes, I'm interested"}
                </option>
                <option value="no">{pre ? "No" : "No, not this time"}</option>
              </select>
            </Field>
            {!pre && (
              <Field label="The most I'd invest (£)" hint="Needed if yes">
                <input name="maxTicketGbp" inputMode="numeric" placeholder="e.g. 5,000" className={inputClass} />
              </Field>
            )}
            <Field label="Note for DXV (optional)">
              <input name="note" maxLength={1000} className={inputClass} />
            </Field>
          </div>
          <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
            {mine ? "Change my answer" : "Send my answer"}
          </SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
