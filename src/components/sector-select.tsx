// The sector drop-down (Blue, 2026-10-21: one list, no free text): the apply form, the deal
// page, and both portfolios. Server-component safe (a plain <select>). An older value that
// isn't on the list shows as "… (not on the list)" until someone picks a real one; saving
// insists on a sector from the list.
import { SECTORS, canonicalSector, isSector } from "@/lib/pipeline";
import { inputClass } from "./ui";

export function SectorSelect({ value, name = "sector", required = false, id }: { value?: string | null; name?: string; required?: boolean; id?: string }) {
  const current = canonicalSector(value);
  const legacy = current && !isSector(current) ? current : null;
  return (
    <select id={id} name={name} required={required} defaultValue={current ?? ""} className={inputClass}>
      {legacy && <option value={legacy}>{legacy} (not on the list: choose one)</option>}
      <option value="">{required ? "Choose a sector…" : "Not known"}</option>
      {SECTORS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
