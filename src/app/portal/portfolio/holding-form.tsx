// The investment form: every field for an investment outside DXV; for a DXV syndicate
// investment, only the angel's own details (the company, amount and date come from DXV).
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { HOLDING_STATUS_LABELS, INSTRUMENT_LABELS, INVESTMENT_ROUNDS, PORTFOLIO_CURRENCIES, TAX_SCHEME_LABELS } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";

export type HoldingDefaults = {
  companyName?: string | null;
  description?: string | null;
  sector?: string | null;
  investedVia?: string | null;
  round?: string | null;
  investedOn?: Date | null;
  currency?: string;
  amountMinor?: number | null;
  instrument?: string | null;
  valuationAtInvestment?: number | null;
  sharePrice?: number | null;
  shares?: number | null;
  currentValueMinor?: number | null;
  currentValueOn?: Date | null;
  status?: string;
  proceedsMinor?: number | null;
  taxScheme?: string | null;
  taxCertificateReceived?: boolean;
  shareCertificateReceived?: boolean;
  keyDate?: Date | null;
  keyDateNote?: string | null;
  source?: string | null;
  rationale?: string | null;
  notes?: string | null;
};

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const amount = (minor: number | null | undefined) => (minor == null ? "" : String(minor % 100 === 0 ? minor / 100 : (minor / 100).toFixed(2)));

export function HoldingForm({
  action,
  outside,
  v = {},
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /** Outside DXV: the company, amount and date are the angel's to enter. */
  outside: boolean;
  v?: HoldingDefaults;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-5">
      {outside && (
        <Section title="The investment">
          <Field label="Company name *">
            <input name="companyName" required defaultValue={v.companyName ?? ""} className={inputClass} />
          </Field>
          <Field label="What they do">
            <input name="description" defaultValue={v.description ?? ""} placeholder="e.g. Wearable reducing perineal tears" className={inputClass} />
          </Field>
          <Field label="Sector">
            <input name="sector" defaultValue={v.sector ?? ""} placeholder="e.g. HealthTech" className={inputClass} />
          </Field>
          <Field label="Invested with">
            <input name="investedVia" defaultValue={v.investedVia ?? ""} placeholder="Direct, or a syndicate / platform" className={inputClass} />
          </Field>
          <Field label="Round">
            <input name="round" list="portfolio-rounds" defaultValue={v.round ?? ""} placeholder="e.g. Pre-Seed" className={inputClass} />
            <datalist id="portfolio-rounds">
              {INVESTMENT_ROUNDS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="Date I invested">
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
          <Field label="Amount I invested *">
            <input name="amount" required inputMode="decimal" defaultValue={amount(v.amountMinor)} placeholder="e.g. 1,000" className={inputClass} />
          </Field>
        </Section>
      )}
      {!outside && (
        <Section title="About the company">
          <Field label="What they do (for your own reference)">
            <input name="description" defaultValue={v.description ?? ""} className={inputClass} />
          </Field>
        </Section>
      )}

      <Section title="Terms">
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
          <input name="sharePrice" inputMode="decimal" defaultValue={v.sharePrice ?? ""} placeholder="e.g. 2.40" className={inputClass} />
        </Field>
        <Field label="Number of shares I received">
          <input name="shares" inputMode="numeric" defaultValue={v.shares ?? ""} className={inputClass} />
        </Field>
      </Section>

      <Section title="Value today">
        <Field label="Status">
          <select name="status" defaultValue={v.status ?? "ACTIVE"} className={inputClass}>
            {Object.entries(HOLDING_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Current value" hint="Blank: counted at cost until you revalue it">
          <input name="currentValue" inputMode="decimal" defaultValue={amount(v.currentValueMinor)} className={inputClass} />
        </Field>
        <Field label="Value as of">
          <input name="currentValueOn" type="date" defaultValue={day(v.currentValueOn)} className={inputClass} />
        </Field>
        <Field label="Proceeds received" hint="If exited">
          <input name="proceeds" inputMode="decimal" defaultValue={amount(v.proceedsMinor)} className={inputClass} />
        </Field>
      </Section>

      <Section title="Tax relief and paperwork">
        <Field label="S/EIS">
          <select name="taxScheme" defaultValue={v.taxScheme ?? ""} className={inputClass}>
            <option value="">Not sure yet</option>
            {Object.entries(TAX_SCHEME_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="taxCertificateReceived" defaultChecked={v.taxCertificateReceived} />
          S/EIS certificate (SEIS3/EIS3) received
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="shareCertificateReceived" defaultChecked={v.shareCertificateReceived} />
          Share certificate received
        </label>
      </Section>

      <Section title="Dates to diarise">
        <Field label="Key date">
          <input name="keyDate" type="date" defaultValue={day(v.keyDate)} className={inputClass} />
        </Field>
        <Field label="What happens then">
          <input name="keyDateNote" defaultValue={v.keyDateNote ?? ""} placeholder="e.g. ASA longstop, follow-on round" className={inputClass} />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="How I heard about it">
          <input name="source" defaultValue={v.source ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Why I invested">
            <textarea name="rationale" rows={3} defaultValue={v.rationale ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={v.notes ?? ""} className={inputClass} />
          </Field>
        </div>
      </Section>

      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-black/10 bg-white p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
