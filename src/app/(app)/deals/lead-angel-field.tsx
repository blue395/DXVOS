"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { LEAD_ANGELS } from "@/lib/pipeline";

/** Lead angel: one of DXV's usual leads, or "Other" with a name typed in. Posts as `leadAngel`. */
export function LeadAngelField({ value }: { value?: string | null }) {
  const known = (LEAD_ANGELS as readonly string[]).includes(value ?? "");
  const [choice, setChoice] = useState(value ? (known ? value : "other") : "");
  const [other, setOther] = useState(value && !known ? value : "");
  const leadAngel = choice === "other" ? other.trim() : choice;

  return (
    <Field label="Lead angel">
      <input type="hidden" name="leadAngel" value={leadAngel} />
      <div className="flex gap-2">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass} aria-label="Lead angel">
          <option value="">Not assigned</option>
          {LEAD_ANGELS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
          <option value="other">Other…</option>
        </select>
        {choice === "other" && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Name"
            aria-label="Other lead angel"
            required
            autoFocus
            className={inputClass}
          />
        )}
      </div>
    </Field>
  );
}
