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
