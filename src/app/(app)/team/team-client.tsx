"use client";

// Team page controls: invite a partner (link shown once), reset links, revoke/restore.

import { useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { OneTimeLink, shortDate } from "@/components/one-time-link";
import { buttonClass, Field, inputClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { cancelTeamInvite, grantTeamAccess, inviteTeamMember, setTeamAccess, teamResetLink, type TeamLinkResult } from "./actions";

type Made = { url: string; expires: string; emailedTo?: string; emailError?: string };

function useLink() {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<Made | null>(null);
  const [working, setWorking] = useState<"email" | "copy">("copy");
  const [error, setError] = useState<string | null>(null);
  const [memberLogin, setMemberLogin] = useState<{ userId: string; name: string } | null>(null);
  const run = (fn: () => Promise<TeamLinkResult>, which: "email" | "copy" = "copy") => {
    setWorking(which);
    start(async () => {
      setError(null);
      setLink(null);
      setMemberLogin(null);
      try {
        const res = await fn();
        if ("error" in res) {
          setError(res.error);
          setMemberLogin(res.memberLogin ?? null);
        }
        else setLink({ url: res.link, expires: shortDate(res.expiresAt), emailedTo: res.emailedTo, emailError: res.emailError });
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });
  };
  return { pending, working, link, error, run, memberLogin, setMemberLogin, setError };
}

function Feedback({ error, link }: { error: string | null; link: Made | null }) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
          {error}
        </p>
      )}
      {link && <OneTimeLink url={link.url} expires={link.expires} emailedTo={link.emailedTo} emailError={link.emailError} />}
    </>
  );
}

/** Email + copy buttons for a link: the email one only when DXV OS can send email. */
function LinkButtons({
  canEmail,
  pending,
  working,
  emailLabel,
  copyLabel,
  onEmail,
  onCopy,
  primary = true,
}: {
  canEmail: boolean;
  pending: boolean;
  working: "email" | "copy";
  emailLabel: string;
  copyLabel: string;
  onEmail?: () => void;
  onCopy?: () => void;
  primary?: boolean;
}) {
  const label = (which: "email" | "copy", text: string) =>
    pending && working === which ? (
      <>
        <Spinner /> {which === "email" ? "Sending…" : "Creating…"}
      </>
    ) : (
      text
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      {canEmail && (
        <button type={onEmail ? "button" : "submit"} value="email" disabled={pending} className={buttonClass(primary ? "primary" : "secondary")} onClick={onEmail}>
          {label("email", emailLabel)}
        </button>
      )}
      <button
        type={onCopy ? "button" : "submit"}
        value="copy"
        disabled={pending}
        className={canEmail ? "rounded-md px-2 py-1.5 text-sm text-dxv-green underline hover:bg-dxv-green/5" : buttonClass(primary ? "primary" : "secondary")}
        onClick={onCopy}
      >
        {label("copy", canEmail ? `${copyLabel} to copy instead` : copyLabel)}
      </button>
    </span>
  );
}

export function InviteForm({ canEmail }: { canEmail: boolean }) {
  const { pending, working, link, error, run, memberLogin, setMemberLogin, setError } = useLink();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const send = canEmail && (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "email";
        run(() => inviteTeamMember({ name, email }, send), send ? "email" : "copy");
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
      <LinkButtons canEmail={canEmail} pending={pending} working={working} emailLabel="Email invite" copyLabel="Create invite link" />
      <Feedback error={error} link={link} />
      {memberLogin && (
        <div className="space-y-2 rounded-md border border-dxv-green/30 bg-dxv-green/[0.04] p-3 text-sm">
          <p>
            Partners are angels too, so they use one login for both. Give {memberLogin.name}&apos;s member login team access? They keep their email and
            password, see the team app when they sign in, and reach their member portal from the header.
          </p>
          <ActionButton
            run={async () => {
              const res = await grantTeamAccess(memberLogin.userId);
              if (!res.error) {
                setMemberLogin(null);
                setError(null);
                setName("");
                setEmail("");
              }
              return res;
            }}
            pendingLabel="Giving access…"
            confirm={`Give ${memberLogin.name} full team access to DXV OS?`}
          >
            Give {memberLogin.name.split(" ")[0]} team access
          </ActionButton>
        </div>
      )}
    </form>
  );
}

export function ResetLinkButton({ userId, email, canEmail }: { userId: string; email: string; canEmail: boolean }) {
  const { pending, working, link, error, run } = useLink();
  return (
    <div className="space-y-2">
      <LinkButtons
        canEmail={canEmail}
        pending={pending}
        working={working}
        primary={false}
        emailLabel="Email password reset link"
        copyLabel="Password reset link"
        onEmail={() => {
          if (window.confirm(`Email a password reset link to ${email}?`)) run(() => teamResetLink(userId, true), "email");
        }}
        onCopy={() => run(() => teamResetLink(userId), "copy")}
      />
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
      confirm={`Revoke ${name}'s access? They're signed out straight away (team app and member portal) and can't sign in until someone restores it. Nothing they did is removed.`}
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
