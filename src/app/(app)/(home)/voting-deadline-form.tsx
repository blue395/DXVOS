"use client";

// Dashboard: when members' pitch-selection vote closes for the round open to them (UK time).

import { ActionForm, SubmitButton } from "@/components/action-form";
import { PRE_SELECTION_VOTE_LIMIT } from "@/lib/pipeline";
import { setVotingDeadline } from "./member-round-actions";

export function VotingDeadlineForm({ current }: { current: string }) {
  return (
    <ActionForm action={setVotingDeadline} resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
      <label htmlFor="votingClosesAt" className="font-medium">
        Voting closes:
      </label>
      <input
        id="votingClosesAt"
        name="votingClosesAt"
        type="datetime-local"
        defaultValue={current}
        className="rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm"
        aria-describedby="votingClosesAtHint"
      />
      <SubmitButton variant="secondary">Save</SubmitButton>
      <span id="votingClosesAtHint" className="w-full text-xs text-black/55">
        UK time. Leave blank for &quot;to be confirmed&quot;. Members can say yes to {PRE_SELECTION_VOTE_LIMIT} companies each and change their votes until
        then.
      </span>
    </ActionForm>
  );
}
