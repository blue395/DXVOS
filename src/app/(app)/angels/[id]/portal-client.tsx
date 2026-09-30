"use client";

// Portal access controls on an angel's page: make an invite or reset link (shown once,
// with Copy), revoke or restore access.

import { useState, useTransition } from "react";
import { buttonClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { createAngelLink, setAngelAccess } from "../portal-actions";
import { OneTimeLink } from "@/components/one-time-link";

export function PortalLinkButton({ angelId, kind, label }: { angelId: string; kind: "INVITE" | "RESET"; label: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(kind === "INVITE" ? "primary" : "secondary")}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const res = await createAngelLink(angelId, kind);
              if ("error" in res) setError(res.error);
              else setLink({ url: res.link, expires: new Date(res.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) });
            } catch (e) {
              setError(actionErrorMessage(e));
            }
          })
        }
      >
        {pending ? (
          <>
            <Spinner /> Creating…
          </>
        ) : (
          label
        )}
      </button>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
          {error}
        </p>
      )}
      {link && <OneTimeLink url={link.url} expires={link.expires} />}
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
