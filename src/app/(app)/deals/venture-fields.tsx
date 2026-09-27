import { Field, inputClass } from "@/components/ui";

type VentureValues = {
  name?: string;
  founderNames?: string | null;
  founderEmail?: string | null;
  website?: string | null;
  sector?: string | null;
  companyStage?: string | null;
  raiseAmountGbp?: number | null;
  description?: string | null;
  deckUrl?: string | null;
  driveFolderUrl?: string | null;
};

// Shared by "New venture" and the edit form on the deal page.
export function VentureFields({ v = {} }: { v?: VentureValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company name *">
        <input name="name" required defaultValue={v.name} className={inputClass} />
      </Field>
      <Field label="Founder(s)">
        <input name="founderNames" defaultValue={v.founderNames ?? ""} className={inputClass} />
      </Field>
      <Field label="Founder email">
        <input name="founderEmail" type="email" defaultValue={v.founderEmail ?? ""} className={inputClass} />
      </Field>
      <Field label="Website">
        <input name="website" type="url" placeholder="https://" defaultValue={v.website ?? ""} className={inputClass} />
      </Field>
      <Field label="Sector">
        <input name="sector" defaultValue={v.sector ?? ""} className={inputClass} />
      </Field>
      <Field label="Company stage" hint="e.g. Pre-seed, Seed">
        <input name="companyStage" defaultValue={v.companyStage ?? ""} className={inputClass} />
      </Field>
      <Field label="Raise amount (£)">
        <input name="raiseAmountGbp" inputMode="numeric" defaultValue={v.raiseAmountGbp ?? ""} className={inputClass} />
      </Field>
      <Field label="Deck link" hint="Google Drive link — files stay in Drive">
        <input name="deckUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={v.deckUrl ?? ""} className={inputClass} />
      </Field>
      <Field label="Drive folder link">
        <input name="driveFolderUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={v.driveFolderUrl ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description / eligibility notes" hint="Stage, sector, team and thesis-fit against DXV's underestimated-founder criteria">
          <textarea name="description" rows={4} defaultValue={v.description ?? ""} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
