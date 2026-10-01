"use client";

// Portal access controls on an angel's page: make an invite or reset link (shown once,
// with Copy), revoke or restore access.

import { useState, useTransition } from "react";
import { buttonClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { createAngelLink, linkTeamLogin, setAngelAccess } from "../portal-actions";
import { OneTimeLink, shortDate } from "@/components/one-time-link";

type MadeLink = { url: string; expires: string; emailedTo?: string; emailError?: string };

/**
 * Make an invite or reset link: emailed to them from DXV OS (when email is set up and we
 * have their address), or shown to copy and send by hand.
 */
export function PortalLinkButton({
  angelId,
  kind,
  label,
  emailLabel,
  emailTo,
}: {
  angelId: string;
  kind: "INVITE" | "RESET";
  /** The copy-it-yourself button. */
  label: string;
  /** The email button (omit when email isn't set up). */
  emailLabel?: string;
  emailTo?: string | null;
}) {
  const [pending, start] = useTransition();
  const [working, setWorking] = useState<"email" | "copy" | null>(null);
  const [link, setLink] = useState<MadeLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEmail = !!emailLabel && !!emailTo;
  const make = (send: boolean) => {
    setWorking(send ? "email" : "copy");
    start(async () => {
      setError(null);
      setLink(null);
      try {
        const res = await createAngelLink(angelId, kind, send);
        if ("error" in res) setError(res.error);
        else setLink({ url: res.link, expires: shortDate(res.expiresAt), emailedTo: res.emailedTo, emailError: res.emailError });
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });
  };
  const busy = (which: "email" | "copy", text: string) =>
    pending && working === which ? (
      <>
        <Spinner /> {which === "email" ? "Sending…" : "Creating…"}
      </>
    ) : (
      text
    );
  return (
    <div className="space-y-2">
      <span className="flex flex-wrap items-center gap-2">
        {canEmail && (
          <button
            type="button"
            disabled={pending}
            className={buttonClass(kind === "INVITE" ? "primary" : "secondary")}
            title={`Email the link to ${emailTo}`}
            onClick={() => {
              if (window.confirm(`Email ${kind === "INVITE" ? "an invite" : "a password reset link"} to ${emailTo}?`)) make(true);
            }}
          >
            {busy("email", emailLabel!)}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={canEmail ? "rounded-md px-2 py-1.5 text-sm text-dxv-green underline hover:bg-dxv-green/5" : buttonClass(kind === "INVITE" ? "primary" : "secondary")}
          onClick={() => make(false)}
        >
          {busy("copy", canEmail ? `${label} to copy instead` : label)}
        </button>
      </span>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
          {error}
        </p>
      )}
      {link && <OneTimeLink url={link.url} expires={link.expires} emailedTo={link.emailedTo} emailError={link.emailError} />}
    </div>
  );
}

export function AccessButton({ angelId, enabled }: { angelId: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() => {
          if (!enabled && !window.confirm("Revoke their portal access? They'll be signed out and can't sign in until you restore it.")) return;
          start(async () => {
            try {
              const res = await setAngelAccess(angelId, enabled);
              setError(res.error ?? null);
            } catch (e) {
              setError(actionErrorMessage(e));
            }
          });
        }}
      >
        {pending && <Spinner />}
        {enabled ? "Restore access" : "Revoke access"}
      </button>
      {error && <span className="rounded bg-dxv-yellow/30 px-2 py-0.5 text-xs">{error}</span>}
    </span>
  );
}

/** DXV partners: link this angel record to their team login (one login for both). */
export function LinkTeamLogin({ angelId, team }: { angelId: string; team: { id: string; name: string; email: string }[] }) {
  const [pending, start] = useTransition();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="rounded-md border border-black/10 p-2 text-xs">
      <summary className="cursor-pointer font-medium text-dxv-green">On the DXV team? Link to a team login</summary>
      <p className="mt-1.5 text-black/65">
        For partners who are also angels: their team login reaches this member portal too (one login, no invite needed). They still sign their own
        investor statement there before seeing deals.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Team member" className="rounded border border-black/20 bg-white px-2 py-1">
          <option value="">Choose a team member…</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.email})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !userId}
          className={buttonClass("secondary")}
          onClick={() => {
            const who = team.find((t) => t.id === userId);
            if (!who || !window.confirm(`Link this angel record to ${who.name}'s team login? They'll use the member portal as this angel.`)) return;
            start(async () => {
              setError(null);
              try {
                const res = await linkTeamLogin(angelId, userId);
                if (res.error) setError(res.error);
              } catch (e) {
                setError(actionErrorMessage(e));
              }
            });
          }}
        >
          {pending && <Spinner />}
          {pending ? "Linking…" : "Link"}
        </button>
      </div>
      {error && <p className="mt-1 rounded bg-dxv-yellow/30 px-2 py-0.5">{error}</p>}
    </details>
  );
}
