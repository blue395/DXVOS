"use client";

// Sends a bulk email a few at a time (each request stays short), showing progress. If the
// page is closed part-way, the rest wait here until someone presses "Send the rest".

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { Spinner, buttonClass } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { retryMemberEmail, sendMemberEmailBatch } from "../actions";

type Counts = { sent: number; failed: number; pending: number; sending: number };

export function SendProgress({ id, total, initial, autoStart }: { id: string; total: number; initial: Counts; autoStart: boolean }) {
  const router = useRouter();
  const [counts, setCounts] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      for (;;) {
        const res = await sendMemberEmailBatch(id);
        if ("error" in res) {
          setError(res.error);
          break;
        }
        setCounts(res);
        if (res.pending === 0) break;
      }
    } catch (e) {
      setError(actionErrorMessage(e));
    }
    setRunning(false);
    router.refresh();
  }

  useEffect(() => {
    if (autoStart && !started.current && initial.pending > 0) {
      started.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = counts.sent + counts.failed;
  const pct = total ? Math.round((done / total) * 100) : 100;
  return (
    <section className="space-y-2 rounded-lg border-2 border-dxv-green bg-white p-4" role="status">
      <div className="h-2 overflow-hidden rounded-full bg-black/10">
        <div className="h-full bg-dxv-green transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm">
        {running && <Spinner />} <strong>{counts.sent}</strong> sent
        {counts.failed > 0 && <>, {counts.failed} didn&apos;t send</>}
        {counts.pending > 0 && <>, {counts.pending} to go</>}
        {counts.sending > 0 && !running && <>, {counts.sending} interrupted</>}
        {running ? " · Sending… keep this page open." : counts.pending === 0 && counts.sending === 0 ? " · Done." : ""}
      </p>
      {error && <p className="rounded bg-dxv-yellow/30 px-2 py-1 text-sm">{error}</p>}
      {!running && (
        <div className="flex flex-wrap gap-2">
          {counts.pending > 0 && (
            <button type="button" className={buttonClass()} onClick={() => void run()}>
              Send the rest ({counts.pending})
            </button>
          )}
          {(counts.failed > 0 || counts.sending > 0) && (
            <ActionButton
              variant="secondary"
              pendingLabel="Queuing…"
              confirm="Try again for the ones that didn't send (or were interrupted)? Anyone interrupted part-way might, rarely, get two copies."
              run={async () => {
                const r = await retryMemberEmail(id);
                if (!r.error) {
                  setCounts((c) => ({ ...c, pending: c.pending + c.failed + c.sending, failed: 0, sending: 0 }));
                }
                return r;
              }}
            >
              Try the failed ones again
            </ActionButton>
          )}
        </div>
      )}
    </section>
  );
}
