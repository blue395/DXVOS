// The angel's vote on a shared deal: interest in hearing the pitch (Member Pitch
// Selection), then an expression of interest with a maximum ticket (after the pitch and
// during Investment Commitments). Each answer is a new entry; the latest counts.
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, formatDateTime, inputClass } from "@/components/ui";
import { formatGbp } from "@/lib/pipeline";
import type { DealRoom } from "@/lib/portal-deals";
import { castEoi, castPreSelectionVote } from "../../actions";

export function VotePanel({ deal }: { deal: DealRoom }) {
  if (!deal.voteKind) return null;
  const pre = deal.voteKind === "pre-selection";
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
      <p className="mt-1 text-xs text-black/60">
        {pre
          ? "Only the DXV team sees your answer."
          : "This is an expression of interest, not a commitment: DXV confirms final amounts with you before anything is paid. Only the DXV team sees your answer."}
      </p>
      <ActionForm action={(pre ? castPreSelectionVote : castEoi).bind(null, deal.id)} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={pre ? "Interested? *" : "Invest? *"}>
            <select name="interested" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              <option value="yes">{pre ? "Yes, I'd like to hear them pitch" : "Yes, I'm interested"}</option>
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
    </section>
  );
}
