"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { COMPANY_STAGES, normaliseCompanyStage } from "@/lib/pipeline";

/** Company stage: Pre-Seed, Seed, Series A, Bridge Round, or "Other" with free text. Posts as `companyStage`. */
export function CompanyStageField({ value, aiSuggested }: { value?: string | null; aiSuggested?: boolean }) {
  const normal = normaliseCompanyStage(value);
  const known = (COMPANY_STAGES as readonly string[]).includes(normal ?? "");
  const [choice, setChoice] = useState(normal ? (known ? normal : "other") : "");
  const [other, setOther] = useState(normal && !known ? normal : "");
  const companyStage = choice === "other" ? other.trim() : choice;

  return (
    <Field label="Company stage" aiSuggested={aiSuggested}>
      <input type="hidden" name="companyStage" value={companyStage} />
      <div className="flex gap-2">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass} aria-label="Company stage">
          <option value="">Not known</option>
          {COMPANY_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="other">Other…</option>
        </select>
        {choice === "other" && (
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Series B" aria-label="Other company stage" required className={inputClass} />
        )}
      </div>
    </Field>
  );
}
