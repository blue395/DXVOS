"use client";

// Invite someone new: name + email in, one-time sign-up link out (shown once, with Copy).

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass, Spinner } from "@/components/ui";
import { OneTimeLink } from "@/components/one-time-link";
import { actionErrorMessage } from "@/lib/stale-version";
import { inviteNewAngel } from "../portal-actions";

const inputClass = "w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm focus:border-dxv-green focus:outline-none";

export function InviteForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; angelId?: string } | null>(null);
  const [done, setDone] = useState<{ name: string; angelId: string; url: string; expires: string } | null>(null);

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          <strong>✓ {done.name}</strong> is added as a Prospect. Send them this link:
        </p>
        <OneTimeLink url={done.url} expires={done.expires} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass()} onClick={() => setDone(null)}>
            Invite someone else
          </button>
          <Link href={`/angels/${done.angelId}`} className={buttonClass("secondary")}>
            Open their record
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") ?? "");
        start(async () => {
          setError(null);
          try {
            const res = await inviteNewAngel({ name, email: String(f.get("email") ?? "") });
            if ("error" in res) setError({ text: res.error, angelId: res.existingAngelId });
            else
              setDone({
                name: name.trim(),
                angelId: res.angelId,
                url: res.link,
                expires: new Date(res.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
              });
          } catch (err) {
            setError({ text: actionErrorMessage(err) });
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Full name</span>
          <input name="name" required maxLength={120} autoComplete="off" className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Email</span>
          <input name="email" type="email" required autoComplete="off" className={inputClass} />
          <span className="block text-xs text-black/50">This becomes their login.</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-sm">
          {error.text}{" "}
          {error.angelId && (
            <Link href={`/angels/${error.angelId}`} className="font-medium text-dxv-green underline">
              Open their page
            </Link>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? (
          <>
            <Spinner /> Creating invite…
          </>
        ) : (
          "Create invite link"
        )}
      </button>
    </form>
  );
}
