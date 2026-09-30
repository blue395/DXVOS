"use client";

// Team page controls: invite a partner (link shown once), reset links, revoke/restore.

import { useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { OneTimeLink, shortDate } from "@/components/one-time-link";
import { buttonClass, Field, inputClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { cancelTeamInvite, inviteTeamMember, setTeamAccess, teamResetLink, type TeamLinkResult } from "./actions";

function useLink() {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<TeamLinkResult>) =>
    start(async () => {
      setError(null);
      setLink(null);
      try {
        const res = await fn();
        if ("error" in res) setError(res.error);
        else setLink({ url: res.link, expires: shortDate(res.expiresAt) });
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });
  return { pending, link, error, run };
}

function Feedback({ error, link }: { error: string | null; link: { url: string; expires: string } | null }) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
          {error}
        </p>
      )}
      {link && <OneTimeLink url={link.url} expires={link.expires} />}
    </>
  );
}

export function InviteForm() {
  const { pending, link, error, run } = useLink();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => inviteTeamMember({ name, email }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="e.g. Anna C" />
        </Field>
        <Field label="Email (their login) *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? (
          <>
            <Spinner /> Creating…
          </>
        ) : (
          "Create invite link"
        )}
      </button>
      <Feedback error={error} link={link} />
    </form>
  );
}

export function ResetLinkButton({ userId }: { userId: string }) {
  const { pending, link, error, run } = useLink();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => run(() => teamResetLink(userId))}>
        {pending && <Spinner />}
        {pending ? "Creating…" : "Password reset link"}
      </button>
      <Feedback error={error} link={link} />
    </div>
  );
}

export function AccessButton({ userId, name, enabled }: { userId: string; name: string; enabled: boolean }) {
  return enabled ? (
    <ActionButton run={() => setTeamAccess(userId, true)} variant="secondary" pendingLabel="Restoring…">
      Restore access
    </ActionButton>
  ) : (
    <ActionButton
      run={() => setTeamAccess(userId, false)}
      variant="secondary"
      pendingLabel="Revoking…"
      confirm={`Revoke ${name}'s access? They're signed out straight away and can't sign in until someone restores it. Nothing they did is removed.`}
    >
      Revoke access
    </ActionButton>
  );
}

export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  return (
    <ActionButton run={() => cancelTeamInvite(inviteId)} variant="secondary" pendingLabel="Cancelling…" confirm="Cancel this link? It stops working straight away.">
      Cancel link
    </ActionButton>
  );
}
