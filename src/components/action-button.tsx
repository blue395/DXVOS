"use client";

import { useState, useTransition } from "react";
import { buttonClass, Spinner, type ButtonVariant } from "./ui";

/** A button that runs a server action with no form fields, with a spinner and inline errors. */
export function ActionButton({
  run,
  children,
  variant = "primary",
  confirm,
  pendingLabel = "Working…",
  onDone,
}: {
  run: () => Promise<{ error?: string; ok?: boolean }>;
  children: React.ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  pendingLabel?: string;
  /** Called after a successful run (e.g. to tell the job tray a job started). */
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={buttonClass(variant)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const res = await run();
            setError(res.error ?? null);
            if (!res.error) onDone?.();
          });
        }}
      >
        {pending ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          children
        )}
      </button>
      {error && (
        <span role="alert" className="rounded bg-dxv-yellow/30 px-2 py-0.5 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
