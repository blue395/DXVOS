"use client";

// Open members' voting, and (ticked by default) email every member who can see deals.
// The text boxes are uncontrolled, so typing before hydration can't double the text.

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { openAngelVoting } from "./actions";

export function OpenVotingForm({
  round,
  subject,
  body,
  recipients,
  canEmail,
}: {
  round: number;
  subject: string;
  body: string;
  recipients: number;
  canEmail: boolean;
}) {
  const [email, setEmail] = useState(canEmail && recipients > 0);
  return (
    <ActionForm action={openAngelVoting} resetOnSuccess={false} className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="sendEmail" checked={email} disabled={!canEmail} onChange={(e) => setEmail(e.target.checked)} className="mt-1" />
        <span>
          <strong>Email members now</strong> ({recipients} member{recipients === 1 ? "" : "s"} who can see deals)
          {!canEmail && <span className="block text-xs text-black/55">Email isn&apos;t set up, so voting can only be opened without an email.</span>}
        </span>
      </label>
      {email && (
        <>
          <Field label="Subject">
            <input name="subject" defaultValue={subject} required maxLength={200} className={inputClass} />
          </Field>
          <Field label="Message" hint="{{first_name}} is each member's first name; {{platform_link}} is the sign-in page. [text](link) makes a link.">
            <textarea name="body" defaultValue={body} required rows={14} className={`${inputClass} font-mono text-xs`} />
          </Field>
        </>
      )}
      <SubmitButton pendingLabel="Opening…" doneLabel="Voting open">
        {email ? `Open Round ${round} voting and email ${recipients} member${recipients === 1 ? "" : "s"}` : `Open Round ${round} voting`}
      </SubmitButton>
      <p className="text-xs text-black/55">
        Members can then vote for up to 3 companies until the deadline. Votes cast before now don&apos;t count. The email goes in batches from its page, with an
        unsubscribe link, and is kept under Angels → Email angels.
      </p>
    </ActionForm>
  );
}
