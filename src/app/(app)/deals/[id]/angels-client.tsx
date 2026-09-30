"use client";

// Deal-room controls on the deal page: share/stop sharing, and each document's visibility.

import { useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { Spinner } from "@/components/ui";
import { ANGEL_DOC_PHASE_LABELS, type AngelDocVisibility } from "@/lib/pipeline";
import { actionErrorMessage } from "@/lib/stale-version";
import { setDealShared, setDocumentAngelVisibility } from "./share-actions";

export function ShareToggle({ ventureId, shared, name }: { ventureId: string; shared: boolean; name: string }) {
  return shared ? (
    <ActionButton
      run={() => setDealShared(ventureId, false)}
      variant="secondary"
      pendingLabel="Stopping…"
      confirm={`Stop sharing ${name}? Members will no longer see it (their votes are kept).`}
    >
      Stop sharing
    </ActionButton>
  ) : (
    <ActionButton
      run={() => setDealShared(ventureId, true)}
      pendingLabel="Sharing…"
      confirm={`Share ${name} with members? Certified members will see it from Member Pitch Selection, with what's listed here.`}
    >
      Share with members
    </ActionButton>
  );
}

export function DocVisibilitySelect({ documentId, value, fileName }: { documentId: string; value: "" | AngelDocVisibility; fileName: string }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(value);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label={`Members see ${fileName}`}
        value={current}
        disabled={pending}
        className="rounded border border-black/15 bg-white px-1.5 py-0.5 text-xs"
        onChange={(e) => {
          const next = e.target.value as typeof value;
          const prev = current;
          setCurrent(next);
          setMsg(null);
          start(async () => {
            try {
              const res = await setDocumentAngelVisibility(documentId, next);
              if (res.error) {
                setCurrent(prev);
                setMsg(res.error);
              } else setMsg("✓ Saved");
            } catch (err) {
              setCurrent(prev);
              setMsg(actionErrorMessage(err));
            }
          });
        }}
      >
        <option value="">Hidden from members</option>
        <option value="POST_PITCH">{ANGEL_DOC_PHASE_LABELS.POST_PITCH}</option>
        <option value="COMMITMENTS">{ANGEL_DOC_PHASE_LABELS.COMMITMENTS}</option>
        <option value="DUE_DILIGENCE">{ANGEL_DOC_PHASE_LABELS.DUE_DILIGENCE}</option>
      </select>
      {pending && <Spinner className="h-3 w-3" />}
      {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-dxv-green" : "rounded bg-dxv-yellow/30 px-1"}`}>{msg}</span>}
    </span>
  );
}
