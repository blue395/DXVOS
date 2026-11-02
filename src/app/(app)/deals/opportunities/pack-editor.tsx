// The partners' working copy of an opportunities pack: one card per company slide, in the
// slide's field order. One form, sticky Save. Field names are `<ventureId>.<field>`.
import Link from "next/link";
import { ActionForm, SavedNote, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import type { OpportunityContent } from "@/lib/opportunities/schema";
import { saveOpportunityPack } from "./actions";

const LONG = new Set(["summary", "traction", "assessment"]);

export function PackEditor({ id, version, content, themes }: { id: string; version: string; content: OpportunityContent; themes: string[] }) {
  return (
    <ActionForm action={saveOpportunityPack.bind(null, id)} resetOnSuccess={false} savedMs={4000} className="space-y-5">
      <input type="hidden" name="version" value={version} readOnly />
      <Field label="Pack title (cover slide)" hint='e.g. "Syndicate Opportunities, November 2026"'>
        <input name="title" defaultValue={content.title} maxLength={120} className={inputClass} />
      </Field>
      {content.deals.map((d) => {
        const n = (f: string) => `${d.ventureId}.${f}`;
        const themeOptions = themes.some((t) => t.toLowerCase() === d.theme.toLowerCase()) ? themes : [d.theme, ...themes];
        return (
          <section key={d.ventureId} id={`slide-${d.ventureId}`} className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
            <h3 className="text-lg font-semibold text-dxv-green">
              <Link href={`/deals/${d.ventureId}`} className="hover:underline">
                {d.name}
              </Link>
            </h3>
            {d.error && (
              <p role="note" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
                The AI couldn&apos;t draft this slide: {d.error} You can write it below.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Impact theme (slide group)">
                <select name={n("theme")} defaultValue={d.theme} className={inputClass}>
                  {themeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sector">
                <input name={n("sector")} defaultValue={d.sector} className={inputClass} />
              </Field>
              <Field label="EIS/SEIS">
                <input name={n("taxScheme")} defaultValue={d.taxScheme} className={inputClass} />
              </Field>
              <Field label="Date founded">
                <input name={n("dateFounded")} defaultValue={d.dateFounded} className={inputClass} />
              </Field>
              <Field label="Founders' diversity" hint="Only what the founders stated.">
                <input name={n("founderDiversity")} defaultValue={d.founderDiversity} className={inputClass} />
              </Field>
              <Field label="Raising">
                <input name={n("raising")} defaultValue={d.raising} className={inputClass} />
              </Field>
            </div>
            {(
              [
                ["summary", "Summary"],
                ["revenue", "Revenue to date"],
                ["traction", "Early traction"],
                ["useOfFunds", "Use of funds"],
                ["assessment", "DXV assessment (shown in yellow)"],
              ] as const
            ).map(([f, label]) => (
              <Field key={f} label={label}>
                {LONG.has(f) ? (
                  <textarea name={n(f)} rows={4} defaultValue={d[f]} className={inputClass} />
                ) : (
                  <input name={n(f)} defaultValue={d[f]} className={inputClass} />
                )}
              </Field>
            ))}
          </section>
        );
      })}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <SubmitButton>Save pack</SubmitButton>
        <SavedNote>Pack saved. Preview the PDF to check the slides.</SavedNote>
      </div>
    </ActionForm>
  );
}
