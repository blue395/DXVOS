"use client";

// An instant shareable link's page: accept the member terms and confirm 18+, then sign up
// with Google / Microsoft (straight in), or give a name and email (one confirm email, then
// straight to setting a password). No waiting for the DXV team.

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { InstantJoinButtons } from "@/components/provider-buttons";
import { Field, inputClass } from "@/components/ui";
import type { OAuthProvider } from "@/generated/prisma/enums";
import { PRIVACY_NOTICE_URL, TERMS_URL } from "@/lib/legal-links";
import { askToJoin } from "../actions";

export function InstantJoin({ token, providers, terms, formToken }: { token: string; providers: OAuthProvider[]; terms: React.ReactNode; formToken: string }) {
  const [termsTicked, setTermsTicked] = useState(false);
  const [adult, setAdult] = useState(false);
  const agreed = termsTicked && adult;
  return (
    <div className="space-y-5">
      {providers.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Quickest: sign up with Google or Microsoft</p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-black/15 bg-black/[0.02] p-3 text-sm">{terms}</div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={termsTicked} onChange={(e) => setTermsTicked(e.target.checked)} className="mt-1" />
            <span>I have read and accept the DXV member terms and privacy notice.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
            <span>I confirm I am 18 or over.</span>
          </label>
          <p className="text-xs text-black/60">
            See our{" "}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline">
              terms
            </a>{" "}
            and{" "}
            <a href={PRIVACY_NOTICE_URL} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline">
              privacy notice
            </a>
            .
          </p>
          <InstantJoinButtons token={token} providers={providers} agreed={agreed} />
          <p className="flex items-center gap-3 pt-2 text-xs text-black/50 before:h-px before:flex-1 before:bg-black/10 after:h-px after:flex-1 after:bg-black/10">
            or use your email
          </p>
        </div>
      )}
      <ActionForm action={askToJoin.bind(null, token)} resetOnSuccess={false} className="space-y-3">
        <input type="hidden" name="formToken" value={formToken} />
        {/* Left empty by people; bots fill it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <Field label="Your name">
          <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Your email">
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
        </Field>
        <p className="text-xs text-black/55">We&apos;ll email you a link to confirm it&apos;s yours, which takes you straight to setting up your account.</p>
        <SubmitButton pendingLabel="Sending…" doneLabel="Sent">
          Email me a sign-up link
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
