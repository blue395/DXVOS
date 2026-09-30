"use client";

// Dashboard: choose the round members see on their deals board (saves on change).

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { actionErrorMessage } from "@/lib/stale-version";
import { setMemberRound } from "./member-round-actions";

export function MemberRoundSelect({ current, rounds }: { current: number | null; rounds: number[] }) {
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        aria-label="Round open to members"
        value={value}
        disabled={pending}
        className="rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-sm font-medium text-dxv-green"
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setMsg(null);
          start(async () => {
            try {
              const res = await setMemberRound(next === "" ? null : Number(next));
              if (res.error) {
                setValue(prev);
                setMsg(res.error);
              } else setMsg("✓ Saved");
            } catch (err) {
              setValue(prev);
              setMsg(actionErrorMessage(err));
            }
          });
        }}
      >
        <option value="">No round (board hidden)</option>
        {rounds.map((r) => (
          <option key={r} value={r}>
            Round {r}
          </option>
        ))}
      </select>
      {pending && <Spinner />}
      {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-dxv-green" : "rounded bg-dxv-yellow/30 px-1"}`}>{msg}</span>}
    </span>
  );
}
