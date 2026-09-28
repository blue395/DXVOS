import { Field, inputClass } from "@/components/ui";

type VentureValues = {
  name?: string | null;
  founderNames?: string | null;
  founderEmail?: string | null;
  website?: string | null;
  sector?: string | null;
  companyStage?: string | null;
  raiseAmountGbp?: number | null;
  round?: number | null;
  investedAmountGbp?: number | null;
  description?: string | null;
  deckUrl?: string | null;
  driveFolderUrl?: string | null;
};

// Shared by "New venture" and the edit form on the deal page.
// `ai` lists fields pre-filled from a deck, which get an "AI suggested" tag.
// `roundOptions`: how many rounds to offer in the Round dropdown.
// `showInvested`: the "amount invested" input, only relevant once a deal is live (edit form).
export function VentureFields({
  v = {},
  ai = [],
  roundOptions = 12,
  showInvested = false,
}: {
  v?: VentureValues;
  ai?: string[];
  roundOptions?: number;
  showInvested?: boolean;
}) {
  const tag = (field: string) => ai.includes(field);
  const rounds = Array.from({ length: Math.max(roundOptions, v.round ?? 0) }, (_, i) => i + 1);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Round" hint="Which DXV round this deal is in">
        <select name="round" defaultValue={v.round ?? ""} className={inputClass}>
          <option value="">Not assigned</option>
          {rounds.map((r) => (
            <option key={r} value={r}>
              Round {r}
            </option>
          ))}
        </select>
      </Field>
      {showInvested ? (
        <Field label="Amount invested by DXV (£)" hint="Fill in once the investment completes; counts towards the dashboard total">
          <input name="investedAmountGbp" inputMode="numeric" defaultValue={v.investedAmountGbp ?? ""} className={inputClass} />
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <Field aiSuggested={tag("name")} label="Company name *">
        <input name="name" required defaultValue={v.name ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("founderNames")} label="Founder(s)">
        <input name="founderNames" defaultValue={v.founderNames ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("founderEmail")} label="Founder email">
        <input name="founderEmail" type="email" defaultValue={v.founderEmail ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("website")} label="Website">
        <input name="website" type="url" placeholder="https://" defaultValue={v.website ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("sector")} label="Sector">
        <input name="sector" defaultValue={v.sector ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("companyStage")} label="Company stage" hint="e.g. Pre-seed, Seed">
        <input name="companyStage" defaultValue={v.companyStage ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("raiseAmountGbp")} label="Raise amount (£)">
        <input name="raiseAmountGbp" inputMode="numeric" defaultValue={v.raiseAmountGbp ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("deckUrl")} label="Deck link" hint="Google Drive link — files stay in Drive">
        <input name="deckUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={v.deckUrl ?? ""} className={inputClass} />
      </Field>
      <Field aiSuggested={tag("driveFolderUrl")} label="Drive folder link">
        <input name="driveFolderUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={v.driveFolderUrl ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field aiSuggested={tag("description")} label="Description / eligibility notes" hint="Stage, sector, team and thesis-fit against DXV's underestimated-founder criteria">
          <textarea name="description" rows={4} defaultValue={v.description ?? ""} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
