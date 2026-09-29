"use client";

// Friendly fallback if a page or action fails unexpectedly (instead of a blank error screen).
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";
import { isStaleActionError, STALE_VERSION_MESSAGE } from "@/lib/stale-version";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const stale = isStaleActionError(error);
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-dxv-yellow bg-dxv-yellow/15 p-6">
      <h1 className="text-lg font-semibold text-dxv-green">{stale ? "DXV OS has been updated" : "Something went wrong"}</h1>
      <p className="text-sm text-black/70">
        {stale ? STALE_VERSION_MESSAGE : "That didn't work. Try again; if it keeps happening, reload the page."}
        {error.digest && <span className="block text-xs text-black/45">Reference: {error.digest}</span>}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary")}>
          Reload page
        </button>
        {!stale && (
          <button type="button" onClick={reset} className={buttonClass("secondary")}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
