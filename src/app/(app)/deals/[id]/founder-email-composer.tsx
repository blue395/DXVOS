"use client";

// Check-and-send: the founder update a decision gate owes, drafted from the team's
// template. The partner reads, edits and sends; nothing goes automatically. Uncontrolled
// boxes, so nothing typed before the page finishes loading is lost or doubled.

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { sendFounderDecisionEmail } from "../actions";

export function FounderEmailComposer({ commId, to, subject, body }: { commId: string; to: string; subject: string; body: string }) {
  return (
    <ActionForm action={sendFounderDecisionEmail.bind(null, commId)} resetOnSuccess={false} className="mt-3 space-y-3 rounded-md border border-black/10 bg-white p-3">
      <p className="text-xs text-black/60">
        To <strong>{to}</strong>, from angels@diversityx.vc (replies go to that inbox). Check and edit, then send; it&apos;s marked Sent here.
      </p>
      <Field label="Subject">
        <input name="subject" required defaultValue={subject} className={inputClass} />
      </Field>
      <Field label="Email">
        <textarea name="body" required rows={12} defaultValue={body} className={`${inputClass} text-sm leading-relaxed`} />
      </Field>
      <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
        Send to founder
      </SubmitButton>
    </ActionForm>
  );
}
