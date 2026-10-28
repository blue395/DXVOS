// The add / edit form for a members' event. Times are typed in UK time.
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { dateToLondonLocal, MEMBER_EVENT_KIND_LABELS } from "@/lib/pipeline";

type EventValues = { kind: "PITCH_SESSION" | "COMMUNITY"; title: string; startsAt: Date; location: string; lumaUrl: string | null; details: string | null };

export function EventForm({
  action,
  event,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  event?: EventValues;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={!event} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type *">
          <select name="kind" required defaultValue={event?.kind ?? "PITCH_SESSION"} className={inputClass}>
            {Object.entries(MEMBER_EVENT_KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name *">
          <input name="title" required maxLength={120} defaultValue={event?.title} placeholder="e.g. DXV pitch night: Round 4" className={inputClass} />
        </Field>
        <Field label="Date and start time (UK) *">
          <input name="startsAt" type="datetime-local" required defaultValue={event ? dateToLondonLocal(event.startsAt) : undefined} className={inputClass} />
        </Field>
        <Field label="Location *" hint='An address, or "Online".'>
          <input name="location" required maxLength={200} defaultValue={event?.location} placeholder="e.g. Impact Hub, Bristol" className={inputClass} />
        </Field>
        <Field label="Luma booking link" hint="https://lu.ma/… or https://luma.com/…">
          <input name="lumaUrl" type="url" maxLength={500} defaultValue={event?.lumaUrl ?? ""} placeholder="https://lu.ma/…" className={inputClass} />
        </Field>
        <Field label="Short note for members (optional)">
          <input name="details" maxLength={500} defaultValue={event?.details ?? ""} placeholder="e.g. Doors 6pm, pitches from 6:30pm" className={inputClass} />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
