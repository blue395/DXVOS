// The syndicate investment form: every field for an investment added by hand; for a
// tracked deal, only the team's details (the company, amounts and angels come from the deal).
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { FounderDiversityField } from "@/components/founder-diversity-field";
import { COMPANY_STAGES, HOLDING_STATUS_LABELS, INSTRUMENT_LABELS, PORTFOLIO_CURRENCIES, TAX_SCHEME_LABELS } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";

export type SyndicateDefaults = {
  companyName?: string | null;
  sector?: string | null;
  round?: number | null;
  companyStage?: string | null;
  investedOn?: Date | null;
  currency?: string;
  amountMinor?: number | null;
  angelsCount?: number | null;
  description?: string | null;
  instrument?: string | null;
  valuationAtInvestment?: number | null;
  sharePrice?: number | null;
  currentValueMinor?: number | null;
  currentValueOn?: Date | null;
  status?: string;
  proceedsMinor?: number | null;
  taxScheme?: string | null;
  diversityThemes?: string[];
  notes?: string | null;
};

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const amount = (minor: number | null | undefined) => (minor == null ? "" : String(minor % 100 === 0 ? minor / 100 : (minor / 100).toFixed(2)));

export function SyndicateForm({
  action,
  added,
  v = {},
  submitLabel,
  dealHref,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /** Tracked deals: where founder diversity is edited (the deal page's Details). */
  dealHref?: string;
  /** Added by hand: the company, amount and angels are the team's to enter. */
  added: boolean;
  v?: SyndicateDefaults;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-5">
      <Section title="The company">
        {added && (
          <>
            <Field label="Company name *">
              <input name="companyName" required defaultValue={v.companyName ?? ""} className={inputClass} />
            </Field>
            <Field label="Sector">
              <input name="sector" defaultValue={v.sector ?? ""} className={inputClass} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="What they do" hint={added ? undefined : "Filled in from the members' summary or the memo; edit it as you like"}>
            <textarea name="description" rows={2} defaultValue={v.description ?? ""} className={inputClass} />
          </Field>
        </div>
      </Section>

      {added && (
        <Section title="The syndicate's investment">
          <Field label="DXV round">
            <input name="round" inputMode="numeric" defaultValue={v.round ?? ""} placeholder="e.g. 1" className={inputClass} />
          </Field>
          <Field label="Company stage">
            <input name="companyStage" list="syndicate-stages" defaultValue={v.companyStage ?? ""} className={inputClass} />
            <datalist id="syndicate-stages">
              {COMPANY_STAGES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Date invested">
            <input name="investedOn" type="date" defaultValue={day(v.investedOn)} className={inputClass} />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={v.currency ?? "GBP"} className={inputClass}>
              {PORTFOLIO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount the syndicate invested *">
            <input name="amount" required inputMode="decimal" defaultValue={amount(v.amountMinor)} placeholder="e.g. 25,000" className={inputClass} />
          </Field>
          <Field label="Number of angels">
            <input name="angelsCount" inputMode="numeric" defaultValue={v.angelsCount ?? ""} className={inputClass} />
          </Field>
        </Section>
      )}

      <Section title="Terms and value today">
        <Field label="Instrument">
          <select name="instrument" defaultValue={v.instrument ?? ""} className={inputClass}>
            <option value="">Not set</option>
            {Object.entries(INSTRUMENT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valuation at the time">
          <input name="valuation" inputMode="decimal" defaultValue={v.valuationAtInvestment ?? ""} placeholder="e.g. 5m" className={inputClass} />
        </Field>
        <Field label="Share price at the time">
          <input name="sharePrice" inputMode="decimal" defaultValue={v.sharePrice ?? ""} className={inputClass} />
        </Field>
        <Field label="S/EIS">
          <select name="taxScheme" defaultValue={v.taxScheme ?? ""} className={inputClass}>
            <option value="">Not set</option>
            {Object.entries(TAX_SCHEME_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={v.status ?? "ACTIVE"} className={inputClass}>
            {Object.entries(HOLDING_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Current value (the syndicate's stake)" hint="Blank: counted at cost">
          <input name="currentValue" inputMode="decimal" defaultValue={amount(v.currentValueMinor)} className={inputClass} />
        </Field>
        <Field label="Value as of">
          <input name="currentValueOn" type="date" defaultValue={day(v.currentValueOn)} className={inputClass} />
        </Field>
        <Field label="Proceeds received" hint="If exited">
          <input name="proceeds" inputMode="decimal" defaultValue={amount(v.proceedsMinor)} className={inputClass} />
        </Field>
      </Section>

      <Section title="Founder diversity">
        <div className="sm:col-span-2">
          {added ? (
            <FounderDiversityField value={v.diversityThemes ?? []} />
          ) : (
            <p className="text-sm text-black/65">
              {v.diversityThemes?.length ? `Recorded: ${v.diversityThemes.join(", ")}. ` : "Not recorded yet. "}
              Founder diversity is kept in one place, the deal&apos;s Details, so the team and members&apos; portfolios always agree.{" "}
              {dealHref && (
                <a href={dealHref} className="font-medium text-dxv-green underline">
                  Edit it on the deal page
                </a>
              )}
            </p>
          )}
        </div>
      </Section>

      <Section title="Notes">
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={4} defaultValue={v.notes ?? ""} placeholder="e.g. why DXV invested, follow-on plans" className={inputClass} />
          </Field>
        </div>
      </Section>

      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
