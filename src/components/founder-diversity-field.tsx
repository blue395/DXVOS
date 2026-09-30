// Founder diversity tick-boxes: DXV's Playbook themes, plus "Other". Only what founders
// have stated themselves, never inferred. Server-component safe (plain inputs).
import { Field, inputClass } from "@/components/ui";
import { FOUNDER_DIVERSITY_THEMES, parseList } from "@/lib/pipeline";

export function FounderDiversityField({ value = [], name = "founderDiversity", hint }: { value?: string[]; name?: string; hint?: React.ReactNode }) {
  const known = new Set<string>(FOUNDER_DIVERSITY_THEMES.map((t) => t.toLowerCase()));
  const other = value.filter((t) => !known.has(t.toLowerCase()));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Founder diversity</p>
      <p className="text-xs text-black/55">
        Only what the founders have stated themselves, never inferred from a name, photo or anything else.{hint ? <> {hint}</> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {FOUNDER_DIVERSITY_THEMES.map((t) => (
          <label
            key={t}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 px-2.5 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green/10"
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

/** The themes a FounderDiversityField submitted (ticked, plus "Other"), de-duplicated. */
export function founderDiversityFrom(formData: FormData, name = "founderDiversity"): string[] {
  return parseList([...formData.getAll(name).map(String), String(formData.get(`${name}Other`) ?? "")].join(","));
}
