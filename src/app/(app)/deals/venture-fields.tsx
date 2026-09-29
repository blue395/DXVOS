import { Field, inputClass } from "@/components/ui";
import { CompanyStageField } from "./company-stage-field";
import { LeadAngelField } from "./lead-angel-field";

type VentureValues = {
  name?: string | null;
  founderNames?: string | null;
  founderEmail?: string | null;
  website?: string | null;
  sector?: string | null;
  companyStage?: string | null;
  raiseAmountGbp?: number | null;
  round?: number | null;
  leadAngel?: string | null;
  description?: string | null;
};

// Shared by "New venture" and the edit form on the deal page.
// `ai` lists fields pre-filled from a deck, which get an "AI suggested" tag.
// `roundOptions`: how many rounds to offer in the Round dropdown.
// (What DXV invested comes from the Final Investment section, not a typed-in amount.)
export function VentureFields({
  v = {},
  ai = [],
  roundOptions = 12,
}: {
  v?: VentureValues;
  ai?: string[];
  roundOptions?: number;
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
      <LeadAngelField value={v.leadAngel} />
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
      <CompanyStageField value={v.companyStage} aiSuggested={tag("companyStage")} />
      <Field aiSuggested={tag("raiseAmountGbp")} label="Raise amount (£)">
        <input name="raiseAmountGbp" inputMode="numeric" defaultValue={v.raiseAmountGbp ?? ""} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field aiSuggested={tag("description")} label="Description / eligibility notes" hint="Stage, sector, team and thesis-fit against DXV's underestimated-founder criteria">
          <textarea name="description" rows={4} defaultValue={v.description ?? ""} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
