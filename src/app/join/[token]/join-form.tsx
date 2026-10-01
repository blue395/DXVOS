"use client";

// The invite page's sign-up: accept the member terms, then either continue with Google /
// Microsoft or choose a password. One terms tick covers both.

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ProviderJoinButtons } from "@/components/provider-buttons";
import { Field, inputClass } from "@/components/ui";
import type { OAuthProvider } from "@/generated/prisma/enums";
import { acceptInvite } from "./actions";

export function JoinForm({
  token,
  email,
  providers,
  minLength,
  terms,
}: {
  token: string;
  email: string;
  providers: OAuthProvider[];
  minLength: number;
  /** The approved member terms, rendered by the page. */
  terms: React.ReactNode;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="max-h-64 overflow-y-auto rounded-md border border-black/15 bg-black/[0.02] p-3 text-sm">{terms}</div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>I have read and accept the DXV member terms and privacy notice.</span>
        </label>
      </div>

      {providers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Set up your login with</p>
          <ProviderJoinButtons token={token} providers={providers} agreed={agreed} />
          <p className="text-xs text-black/55">
            Use any Google or Microsoft account. If its email isn&apos;t {email}, you can choose which one DXV uses afterwards, in My profile.
          </p>
          <p className="flex items-center gap-3 pt-2 text-xs text-black/50 before:h-px before:flex-1 before:bg-black/10 after:h-px after:flex-1 after:bg-black/10">
            or choose a password
          </p>
        </div>
      )}

      <ActionForm action={acceptInvite.bind(null, token)} className="space-y-4" resetOnSuccess={false}>
        <input type="hidden" name="terms" value={agreed ? "on" : ""} />
        <Field label="Your email (your login)">
          <input value={email} readOnly autoComplete="username" className={`${inputClass} bg-black/[0.03]`} />
        </Field>
        <Field label="Choose a password" hint={`At least ${minLength} characters.`}>
          <input name="password" type="password" autoComplete="new-password" required minLength={minLength} className={inputClass} />
        </Field>
        <Field label="Type it again">
          <input name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
        </Field>
        <SubmitButton pendingLabel="Setting up…" doneLabel="Done">
          Create my login
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
