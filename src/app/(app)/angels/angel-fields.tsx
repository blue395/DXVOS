// The angel details form fields (new angel, and editing one). Server-component safe.
import type { AngelStatus } from "@/generated/prisma/enums";
import { Field, inputClass } from "@/components/ui";
import { ANGEL_STATUS_LABELS, ANGEL_TAG_SUGGESTIONS } from "@/lib/pipeline";

export type AngelFieldValues = {
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  bio: string | null;
  status: AngelStatus;
  sectors: string[];
  tags: string[];
  whatsappGroups: string[];
  source: string | null;
  joinedAt: Date | null;
};

export function AngelFields({ v }: { v?: AngelFieldValues }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required defaultValue={v?.name} className={inputClass} />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={v?.status ?? "PROSPECT"} className={inputClass}>
          {(Object.keys(ANGEL_STATUS_LABELS) as AngelStatus[]).map((s) => (
            <option key={s} value={s}>
              {ANGEL_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={v?.email ?? ""} className={inputClass} />
      </Field>
      <Field label="Phone">
        <input name="phone" defaultValue={v?.phone ?? ""} className={inputClass} />
      </Field>
      <Field label="LinkedIn">
        <input name="linkedinUrl" type="url" placeholder="https://www.linkedin.com/in/…" defaultValue={v?.linkedinUrl ?? ""} className={inputClass} />
      </Field>
      <Field label="Location">
        <input name="location" placeholder="e.g. Manchester" defaultValue={v?.location ?? ""} className={inputClass} />
      </Field>
      <Field label="Sectors of interest" hint="Comma-separated, e.g. Fintech, Healthtech">
        <input name="sectors" defaultValue={v?.sectors.join(", ")} className={inputClass} />
      </Field>
      <Field label="Tags" hint={`Only what the angel has shared with you. Suggestions: ${ANGEL_TAG_SUGGESTIONS.join(", ")}`}>
        <input name="tags" list="angel-tag-suggestions" defaultValue={v?.tags.join(", ")} className={inputClass} />
        <datalist id="angel-tag-suggestions">
          {ANGEL_TAG_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="WhatsApp groups" hint="The DXV groups they're in, comma-separated">
        <input name="whatsappGroups" placeholder="e.g. DXV Deal Flow, DXV Community" defaultValue={v?.whatsappGroups.join(", ")} className={inputClass} />
      </Field>
      <Field label="How they came to DXV">
        <input name="source" placeholder="e.g. Pitch night, referral from Anna" defaultValue={v?.source ?? ""} className={inputClass} />
      </Field>
      <Field label="Member since" hint="Set automatically when they first become a member">
        <input name="joinedAt" type="date" defaultValue={v?.joinedAt?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Bio">
          <textarea name="bio" rows={3} defaultValue={v?.bio ?? ""} className={inputClass} placeholder="Background, what they bring to founders…" />
        </Field>
      </div>
    </div>
  );
}
