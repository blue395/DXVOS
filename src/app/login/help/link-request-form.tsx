"use client";

// "Forgot password?": ask for a one-time sign-in link or a password reset link by email.

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { requestLoginLink } from "../actions";

type Kind = "MAGIC" | "RESET";

export function LinkRequestForm({ initialKind, minutes }: { initialKind: Kind; minutes: Record<Kind, number> }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  if (sentTo) {
    return (
      <div className="space-y-3 text-sm" role="status">
        <p className="rounded bg-dxv-green/[0.06] px-3 py-2">
          <strong className="text-dxv-green">Check your inbox.</strong> If <strong>{sentTo}</strong> has a DXV login, we&apos;ve emailed it a{" "}
          {kind === "MAGIC" ? "sign-in link" : "password reset link"}. It works once, for {minutes[kind]} minutes.
        </p>
        <p className="text-black/60">Nothing there after a few minutes? Check your spam folder, or make sure it&apos;s the email you sign in with.</p>
        <button type="button" className="text-dxv-green underline" onClick={() => setSentTo(null)}>
          Send another link
        </button>
      </div>
    );
  }

  return (
    <ActionForm action={requestLoginLink} className="space-y-4" resetOnSuccess={false} onSuccess={() => setSentTo(email.trim())}>
      <Field label="Your email">
        <input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">What would you like?</legend>
        <Choice value="MAGIC" kind={kind} onPick={setKind} title="Email me a sign-in link" note="Sign straight in; your password stays the same." />
        <Choice value="RESET" kind={kind} onPick={setKind} title="Reset my password" note="Choose a new password, then sign in." />
      </fieldset>
      <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
        Email me the link
      </SubmitButton>
    </ActionForm>
  );
}

function Choice({ value, kind, onPick, title, note }: { value: Kind; kind: Kind; onPick: (k: Kind) => void; title: string; note: string }) {
  return (
    <label className={`flex cursor-pointer gap-2 rounded-md border p-2.5 ${kind === value ? "border-dxv-green bg-dxv-green/[0.04]" : "border-black/15"}`}>
      <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => onPick(value)} className="mt-0.5 accent-dxv-green" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-black/60">{note}</span>
      </span>
    </label>
  );
}
