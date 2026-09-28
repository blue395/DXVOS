"use client";

import { useState } from "react";
import type { Stage } from "@/generated/prisma/enums";
import { ALL_STAGES, PASS_REASONS, PASS_REASON_LABELS } from "@/lib/pipeline";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

// Stage control on the deal page. Client component only so the pass-reason field
// can appear when "Passed" is chosen; the actual rules are enforced server-side.
export function StageMover({
  currentStage,
  action,
}: {
  currentStage: Stage;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [to, setTo] = useState<Stage>(currentStage);

  return (
    <ActionForm action={action} className="space-y-3" resetOnSuccess={false}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Move to stage">
          <select name="to" value={to} onChange={(e) => setTo(e.target.value as Stage)} className={inputClass}>
            {ALL_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
                {s.key === currentStage ? " (current)" : ""}
              </option>
            ))}
          </select>
        </Field>
        {to === "PASSED" && (
          <Field label="Reason for passing *">
            <select name="passReason" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose a reason…
              </option>
              {PASS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {PASS_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Note (optional, saved to stage history)">
        <input name="note" className={inputClass} />
      </Field>
      <SubmitButton>Move deal</SubmitButton>
    </ActionForm>
  );
}
