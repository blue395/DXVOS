"use client";

// Portal access controls on an angel's page: make an invite or reset link (shown once,
// with Copy), revoke or restore access.

import { useState, useTransition } from "react";
import { buttonClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { createAngelLink, setAngelAccess } from "../portal-actions";

export function PortalLinkButton({ angelId, kind, label }: { angelId: string; kind: "INVITE" | "RESET"; label: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(kind === "INVITE" ? "primary" : "secondary")}
        onClick={() =>
          start(async () => {
            setError(null);
            setCopied(false);
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
      {link && (
        <div className="space-y-1.5 rounded-md border border-dxv-green/30 bg-dxv-green/[0.04] p-2 text-xs">
          <p className="text-black/70">
            Send this to them by WhatsApp or email. It works once, until {link.expires}, and is only shown now (make a new one if it&apos;s lost).
          </p>
          <div className="flex gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded border border-black/15 bg-white px-2 py-1 font-mono" />
            <button
              type="button"
              className={buttonClass("secondary")}
              onClick={async () => {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
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
