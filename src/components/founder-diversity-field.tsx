// Founder diversity tick-boxes: DXV's Playbook themes, plus "Other". Only what founders
// have stated themselves, never inferred. Server-component safe (plain inputs).
import { FOUNDER_DIVERSITY_THEMES } from "@/lib/pipeline";
import { ThemePills, themesFrom } from "./theme-pills";

export function FounderDiversityField({
  value = [],
  name = "founderDiversity",
  hint,
  label = "Founder diversity",
}: {
  value?: string[];
  name?: string;
  hint?: React.ReactNode;
  label?: string;
}) {
  return (
    <ThemePills
      name={name}
      options={FOUNDER_DIVERSITY_THEMES}
      value={value}
      label={label}
      hint={<>Only what the founders have stated themselves, never inferred from a name, photo or anything else.{hint ? <> {hint}</> : null}</>}
    />
  );
}

/** The themes a FounderDiversityField submitted (ticked, plus "Other"), de-duplicated. */
export function founderDiversityFrom(formData: FormData, name = "founderDiversity"): string[] {
  return themesFrom(formData, name);
}
