"use client";

// The consent screen (onboarding) and Profile > My diversity information. Wording is
// diversity-consent-v1, verbatim (consent-v1.ts). Every question defaults to "Prefer not to
// say" (stores nothing); a category's consent box appears only once it has an answer (and,
// in the profile, only when that answer has changed), never pre-ticked. Inputs are
// uncontrolled; nothing here logs, stores locally or puts answers in the URL.

import { startTransition, useActionState, useState } from "react";
import { buttonClass, Spinner, inputClass } from "@/components/ui";
import { CONSENT_V1 } from "@/lib/diversity/consent-v1";
import {
  CATEGORY_LABELS,
  DIVERSITY_CATEGORIES,
  DIVERSITY_QUESTIONS,
  SELF_DESCRIBE,
  SELF_MAX,
  formValueFor,
  parseDiversityForm,
  planDiversitySave,
  type AnswersByCategory,
  type DiversityAnswerInput,
  type DiversityCategory,
} from "@/lib/diversity/questions";
import { actionErrorMessage } from "@/lib/stale-version";
import { PRIVACY_NOTICE_URL } from "@/lib/legal-links";
import type { DiversityResult } from "@/app/portal/diversity/actions";

type Props = {
  mode: "onboarding" | "profile";
  /** Saved answers (consented), by category. */
  saved: AnswersByCategory;
  /** Answers carried over from the old profile pills: pre-filled, not saved. */
  carriedOver: AnswersByCategory;
  consentGiven: DiversityCategory[];
  action: (prev: DiversityResult, formData: FormData) => Promise<DiversityResult>;
};

export function DiversityForm({ mode, saved, carriedOver, consentGiven, action }: Props) {
  const initial: AnswersByCategory = Object.keys(saved).length ? saved : carriedOver;
  const given = new Set(consentGiven);
  const [state, formAction, pending] = useActionState(async (prev: DiversityResult, fd: FormData): Promise<DiversityResult> => {
    try {
      return await action(prev, fd);
    } catch (e) {
      const msg = actionErrorMessage(e);
      if (msg) return { error: msg };
      throw e;
    }
  }, {});
  const [current, setCurrent] = useState<AnswersByCategory>(initial);
  const [selfOpen, setSelfOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DIVERSITY_QUESTIONS.map((q) => [q.key, formValueFor(q, rowsFor(initial, q.category)).picked.includes(SELF_DESCRIBE)])),
  );
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);

  // Which consent boxes to show: answered categories whose answers aren't already consented as they stand.
  const plan = planDiversitySave(current, new Set(DIVERSITY_CATEGORIES), saved, given);
  const needsBox = DIVERSITY_CATEGORIES.filter((c) => plan[c] === "save");
  const kept = DIVERSITY_CATEGORIES.filter((c) => plan[c] === "keep");
  const refused = new Set(state.refused ?? []);

  return (
    <form
      action={formAction}
      onChange={(e) => setCurrent(parseDiversityForm(new FormData(e.currentTarget)).answers)}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget);
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        setBusy(submitter?.value === "skip" ? "skip" : "save");
        startTransition(() => formAction(fd));
      }}
      className="space-y-5"
    >
      {DIVERSITY_QUESTIONS.map((q) => {
        const v = formValueFor(q, rowsFor(initial, q.category));
        return (
          <fieldset key={q.key} className="space-y-1.5">
            {q.label && <legend className="text-sm font-medium text-black">{q.label}</legend>}
            {q.hint && <p className="text-xs text-black/55">{q.hint}</p>}
            {q.kind === "single" ? (
              <>
                <select
                  name={`q_${q.key}`}
                  defaultValue={v.picked[0] ?? ""}
                  aria-label={q.label || q.hint}
                  className={inputClass}
                  onChange={(e) => setSelfOpen((s) => ({ ...s, [q.key]: e.target.value === SELF_DESCRIBE }))}
                >
                  <option value="">{CONSENT_V1.preferNotToSay}</option>
                  {q.groups.map((g, i) =>
                    g.label ? (
                      <optgroup key={i} label={g.label}>
                        {g.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </optgroup>
                    ) : (
                      g.options.map((o) => <option key={o}>{o}</option>)
                    ),
                  )}
                  {q.selfDescribe && <option value={SELF_DESCRIBE}>{CONSENT_V1.selfDescribe}</option>}
                </select>
                {q.selfDescribe && selfOpen[q.key] && (
                  <span className="block space-y-1">
                    <input name={`q_${q.key}_text`} defaultValue={v.selfText} maxLength={SELF_MAX} autoComplete="off" aria-label={`${q.label} (in your own words)`} className={inputClass} />
                    <span className="block text-xs text-black/55">{CONSENT_V1.freeTextNote}</span>
                  </span>
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.groups[0].options.map((o) => (
                  <label key={o} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dxv-green/25 px-3 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green has-[:checked]:text-white">
                    <input type="checkbox" name={`q_${q.key}`} value={o} defaultChecked={v.picked.includes(o)} className="sr-only" />
                    {o}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}

      {(needsBox.length > 0 || kept.length > 0 || refused.size > 0) && (
        <div className="space-y-3 rounded-lg border border-dxv-green/20 bg-dxv-green/[0.03] p-4">
          {needsBox.map((c) => (
            <div key={c} className="space-y-1">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name={`consent_${c}`} className="mt-1 accent-dxv-green" />
                <span>
                  {CONSENT_V1.consentBoxes[c].before}
                  <strong>{CONSENT_V1.consentBoxes[c].bold}</strong>
                  {CONSENT_V1.consentBoxes[c].after}
                </span>
              </label>
              {refused.has(c) && <NotSaved />}
            </div>
          ))}
          {[...refused].filter((c) => !needsBox.includes(c)).map((c) => (
            <NotSaved key={c} label={CATEGORY_LABELS[c]} />
          ))}
          {kept.map((c) => (
            <p key={c} className="text-xs text-dxv-green">
              ✓ {CATEGORY_LABELS[c]}: you&apos;ve given consent for this answer.
            </p>
          ))}
        </div>
      )}

      <p className="text-sm text-black/65">
        {CONSENT_V1.belowBoxes.before}
        <strong>{CONSENT_V1.belowBoxes.bold}</strong>
        {CONSENT_V1.belowBoxes.middle}
        <a href={PRIVACY_NOTICE_URL} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline">
          {CONSENT_V1.belowBoxes.link}
        </a>
        {CONSENT_V1.belowBoxes.after}
      </p>

      {state.error && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
      {state.ok && !pending && (state.saved?.length || state.withdrawn?.length) ? (
        <p role="status" className="text-sm font-medium text-dxv-green">
          ✓ Saved.{state.withdrawn?.length ? " Answers you changed to “Prefer not to say” have been deleted." : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" name="intent" value="save" disabled={pending} aria-busy={pending && busy === "save"} className={buttonClass()}>
          {pending && busy === "save" ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            CONSENT_V1.saveButton
          )}
        </button>
        {mode === "onboarding" && (
          <button type="submit" name="intent" value="skip" formNoValidate disabled={pending} className={buttonClass("secondary")}>
            {pending && busy === "skip" ? (
              <>
                <Spinner />
                Skipping…
              </>
            ) : (
              CONSENT_V1.skipButton
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function NotSaved({ label }: { label?: string }) {
  return (
    <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-1.5 text-sm">
      {label ? `${label}: ` : ""}
      {CONSENT_V1.notSaved}
    </p>
  );
}

function rowsFor(a: AnswersByCategory, c: DiversityCategory): DiversityAnswerInput[] {
  return a[c] ?? [];
}
