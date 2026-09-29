"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EligibilityDecision, PassReason } from "@/generated/prisma/enums";
import { PASS_REASONS, PASS_REASON_LABELS } from "@/lib/pipeline";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { DeckUploader } from "@/components/deck-uploader";
import { announceJobStarted } from "@/lib/job-events";
import { buttonClass, Field, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { rerunDeckAnalysis } from "../deck-actions";

export function DeckUploadForVenture({ ventureId, label }: { ventureId: string; label?: string }) {
  const router = useRouter();
  return <DeckUploader ventureId={ventureId} label={label} onComplete={() => router.refresh()} />;
}

export function RerunButton({ ventureId, label = "Re-run screen", primary = false }: { ventureId: string; label?: string; primary?: boolean }) {
  return (
    <ActionButton run={() => rerunDeckAnalysis(ventureId)} variant={primary ? "primary" : "secondary"} pendingLabel="Starting…" onDone={announceJobStarted}>
      {label}
    </ActionButton>
  );
}

export function CopyButton({ text, label = "Copy screen as text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

const OPTIONS: { value: EligibilityDecision; label: string; hint: string }[] = [
  { value: "PROCEED", label: "Proceed", hint: "Moves the deal to DXV Partner Review." },
  { value: "DECLINE", label: "Decline", hint: "Moves the deal to Declined with the reason below." },
  { value: "NEED_MORE_INFO", label: "Request more information", hint: "Deal stays here; record what to ask the founder." },
];

/** The human decision. Nothing happens to the deal until a person submits this. */
export function DecisionForm({
  action,
  analysisId,
  suggestedRequest,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  analysisId: string | null;
  /** Pre-fills the note when the AI says to ask the founder for something. */
  suggestedRequest?: string;
}) {
  const [decision, setDecision] = useState<EligibilityDecision | null>(null);
  const [reason, setReason] = useState<PassReason>("INELIGIBLE");

  return (
    <ActionForm action={action} className="space-y-3" resetOnSuccess={false}>
      <input type="hidden" name="analysisId" value={analysisId ?? ""} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Your decision</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-black/10 p-2.5 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green/5">
            <input
              type="radio"
              name="decision"
              value={o.value}
              required
              checked={decision === o.value}
              onChange={() => setDecision(o.value)}
              className="mt-0.5 accent-dxv-green"
            />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="block text-xs text-black/55">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {decision === "DECLINE" && (
        <Field label="Reason for declining *">
          <select name="passReason" value={reason} onChange={(e) => setReason(e.target.value as PassReason)} className={inputClass}>
            {PASS_REASONS.map((r) => (
              <option key={r} value={r}>
                {PASS_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      )}

      {decision && (
        <Field
          label={
            decision === "NEED_MORE_INFO"
              ? "What to request from the founder *"
              : decision === "DECLINE" && reason === "OTHER"
                ? "Note *"
                : "Note (optional)"
          }
        >
          <textarea
            key={decision}
            name="note"
            rows={3}
            defaultValue={decision === "NEED_MORE_INFO" ? (suggestedRequest ?? "") : ""}
            className={inputClass}
          />
        </Field>
      )}

      <SubmitButton>Record decision</SubmitButton>
    </ActionForm>
  );
}
