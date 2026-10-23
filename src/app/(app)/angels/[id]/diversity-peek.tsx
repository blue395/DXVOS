"use client";

// Team angel page: a partner can open this member's diversity answers, with a reason,
// and each view is logged. Shown only on screen, until the page is left.
import { useState } from "react";
import { buttonClass, inputClass, Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { viewAngelDiversity, type PeekResult } from "../diversity-actions";

export function DiversityPeek({ angelId }: { angelId: string }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PeekResult | null>(null);
  if (result?.rows) {
    return (
      <div className="space-y-2">
        {result.rows.length ? (
          <ul className="divide-y divide-black/10 text-sm">
            {result.rows.map((r, i) => (
              <li key={i} className="py-1.5">
                <span className="text-xs text-black/50">{r.category}</span>
                <span className="block">{r.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-black/60">They haven&apos;t shared any (or have withdrawn consent).</p>
        )}
        <button type="button" onClick={() => setResult(null)} className="text-xs text-dxv-green underline">
          Hide
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          setResult(await viewAngelDiversity(angelId, reason));
        } catch (err) {
          setResult({ error: actionErrorMessage(err) ?? "Couldn't load this just now." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs text-black/60">
        Private to the member and used only in combined statistics. Open it only when you need to (e.g. the member asked you to check it). Your name, the
        time and your reason are logged.
      </p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need to see this?" maxLength={300} className={inputClass} aria-label="Reason" />
      {result?.error && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-1.5 text-sm">
          {result.error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonClass("secondary")}>
        {busy ? (
          <>
            <Spinner />
            Opening…
          </>
        ) : (
          "Show diversity information"
        )}
      </button>
    </form>
  );
}
