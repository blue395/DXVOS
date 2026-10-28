// The partners' working copy of a round summary: every deal's section, their view and
// "Take to pitch?". One form, one Save (sticky). Field names are `<ventureId>.<field>`.
import Link from "next/link";
import { ActionForm, SavedNote, SubmitButton } from "@/components/action-form";
import { FounderDiversityField } from "@/components/founder-diversity-field";
import { ThemePills } from "@/components/theme-pills";
import { Field, inputClass } from "@/components/ui";
import { TAKE_TO_PITCH, TAKE_TO_PITCH_LABELS, type RoundSummaryContent } from "@/lib/round-summary/schema";
import { saveRoundSummary } from "./actions";

export function SummaryEditor({ id, version, content, impactThemes }: { id: string; version: string; content: RoundSummaryContent; impactThemes: string[] }) {
  return (
    // Not keyed by version, so "Saved" shows after a save; the hidden version updates with the page.
    <ActionForm action={saveRoundSummary.bind(null, id)} resetOnSuccess={false} savedMs={4000} className="space-y-5">
      <input type="hidden" name="version" value={version} readOnly />
      <Field label="Note for the team (optional)" hint="Shown at the top of the document, e.g. what you'd like everyone to decide by when.">
        <textarea name="intro" rows={2} defaultValue={content.intro} maxLength={2000} className={inputClass} />
      </Field>

      {content.deals.map((d) => {
        const n = (f: string) => `${d.ventureId}.${f}`;
        return (
          <section key={d.ventureId} id={`deal-${d.ventureId}`} className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-dxv-green">
                  <Link href={`/deals/${d.ventureId}`} className="hover:underline">
                    {d.name}
                  </Link>
                </h3>
                {d.facts.oneLiner && <p className="text-sm text-black/70">{d.facts.oneLiner}</p>}
                <p className="text-xs text-black/55">
                  {[
                    d.facts.sector,
                    d.facts.stage,
                    d.facts.raise ? `Raising ${d.facts.raise}` : null,
                    d.facts.eligibility,
                    d.facts.memoScore ? `Memo ${d.facts.memoScore}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-md bg-dxv-yellow/30 px-3 py-1.5 text-sm font-medium">
                Take to pitch?
                <select name={n("takeToPitch")} defaultValue={d.takeToPitch ?? ""} className="rounded-md border border-black/20 bg-white px-2 py-1 text-sm">
                  <option value="">Not decided</option>
                  {TAKE_TO_PITCH.map((t) => (
                    <option key={t} value={t}>
                      {TAKE_TO_PITCH_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {d.error && (
              <p role="note" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
                The AI couldn&apos;t summarise this deal: {d.error} You can write it below.
              </p>
            )}

            <Field label="Headline">
              <textarea name={n("headline")} rows={3} defaultValue={d.headline} className={inputClass} />
            </Field>
            <Field label="Deal terms">
              <input name={n("dealTerms")} defaultValue={d.dealTerms} className={inputClass} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Strengths" hint="One per line">
                <textarea name={n("strengths")} rows={4} defaultValue={d.strengths.join("\n")} className={inputClass} />
              </Field>
              <Field label="Concerns" hint="One per line">
                <textarea name={n("concerns")} rows={4} defaultValue={d.concerns.join("\n")} className={inputClass} />
              </Field>
            </div>
            <Field label="DXV fit">
              <textarea name={n("dxvFit")} rows={2} defaultValue={d.dxvFit} className={inputClass} />
            </Field>
            <ThemePills name={n("impactThemes")} options={impactThemes} value={d.impactThemes} label="Impact themes" />
            <FounderDiversityField name={n("diversityThemes")} label="Diversity themes" value={d.diversityThemes} />
            <Field label="Key open question">
              <input name={n("keyQuestion")} defaultValue={d.keyQuestion} className={inputClass} />
            </Field>
            <Field label="Partner view" hint="Your comments for the team (never written by the AI).">
              <textarea name={n("partnerView")} rows={3} defaultValue={d.partnerView} className={inputClass} />
            </Field>
          </section>
        );
      })}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <SubmitButton>Save summary</SubmitButton>
        <SavedNote>Summary saved. Download it again to share the latest version.</SavedNote>
      </div>
    </ActionForm>
  );
}
