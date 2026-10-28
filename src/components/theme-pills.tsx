// Tick-box pills for a list of themes (DXV's Playbook / founder diversity lists), plus an
// "Other" box, so every theme field on the platform looks and behaves the same.
// Server-component safe (plain inputs); read the answer with themesFrom().
import { Field, inputClass } from "@/components/ui";
import { parseList } from "@/lib/pipeline";

export function ThemePills({
  name,
  options,
  value = [],
  label,
  hint,
}: {
  name: string;
  options: readonly string[];
  value?: string[];
  label: string;
  hint?: React.ReactNode;
}) {
  const known = new Set(options.map((t) => t.toLowerCase()));
  const other = value.filter((t) => !known.has(t.toLowerCase()));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-black/55">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <label
            key={t}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 bg-white px-2.5 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green/10"
          >
            <input type="checkbox" name={name} value={t} defaultChecked={value.some((x) => x.toLowerCase() === t.toLowerCase())} />
            {t}
          </label>
        ))}
      </div>
      <Field label="Other (comma-separated)">
        <input name={`${name}Other`} defaultValue={other.join(", ")} className={inputClass} />
      </Field>
    </div>
  );
}

/** The themes a ThemePills field submitted (ticked, plus "Other"), de-duplicated. */
export function themesFrom(formData: FormData, name: string): string[] {
  return parseList([...formData.getAll(name).map(String), String(formData.get(`${name}Other`) ?? "")].join(","));
}

const OTHER = "__other";

/**
 * Single-choice pills (radio buttons styled like ThemePills), optionally with "Other" and a
 * text box. A value not on the list starts as "Other" with that text, so nothing is lost.
 * Read the answer with choiceFrom().
 */
export function ChoicePills({
  name,
  options,
  value,
  label,
  hint,
  allowOther = false,
}: {
  name: string;
  options: readonly string[];
  value: string | null | undefined;
  label: string;
  hint?: React.ReactNode;
  allowOther?: boolean;
}) {
  const current = (value ?? "").trim();
  const match = options.find((o) => o.toLowerCase() === current.toLowerCase());
  const isOther = !!current && !match;
  const pill =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 bg-white px-2.5 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green/10";
  return (
    <fieldset className="group space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-black/55">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className={pill}>
            <input type="radio" name={name} value={o} defaultChecked={o === match || (!current && o === options[0] && !allowOther)} />
            {o}
          </label>
        ))}
        {(allowOther || isOther) && (
          <label className={pill}>
            <input type="radio" name={name} value={OTHER} defaultChecked={isOther} className="choice-other" />
            Other
          </label>
        )}
      </div>
      {(allowOther || isOther) && (
        <label className="hidden space-y-1 group-has-[.choice-other:checked]:block">
          <span className="block text-xs font-medium text-black/70">Other</span>
          <input name={`${name}Other`} defaultValue={isOther ? current : ""} className={inputClass} />
        </label>
      )}
    </fieldset>
  );
}

/** The answer a ChoicePills field submitted ("Other" gives its text); null if nothing chosen. */
export function choiceFrom(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string" || !v) return null;
  if (v === OTHER) return String(formData.get(`${name}Other`) ?? "").trim() || null;
  return v.trim();
}
