"use client";

import { useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass, Field, inputClass } from "@/components/ui";
import type { MemoContent, MemoScore } from "@/lib/memo-ai/schema";
import { finaliseMemo, generateAssessment, reviseIssue, saveMemoScore, saveMemoText, startReview } from "../../memo-actions";
import { ScoreBadge } from "./memo-view";

/** A button that runs a server action with no form fields and shows its error inline. */
export function ActionButton({
  run,
  children,
  variant = "primary",
  confirm,
}: {
  run: () => Promise<{ error?: string }>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent";
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(variant)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setError((await run()).error ?? null));
        }}
      >
        {pending ? "Working…" : children}
      </button>
      {error && (
        <span role="alert" className="rounded bg-dxv-yellow/30 px-2 py-0.5 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}

export function GenerateButton({ ventureId, again }: { ventureId: string; again: boolean }) {
  return (
    <ActionButton run={() => generateAssessment(ventureId)} variant="accent">
      {again ? "Generate a new AI draft" : "Generate AI assessment"}
    </ActionButton>
  );
}

export function StartReviewButton({
  analysisId,
  aiNumber,
  draftNumber,
  replacing,
}: {
  analysisId: string;
  aiNumber: number;
  draftNumber: number;
  replacing: boolean;
}) {
  return (
    <ActionButton
      run={() => startReview(analysisId)}
      confirm={
        replacing
          ? `Restart DXV Review Draft ${draftNumber} from AI Draft ${aiNumber}? Your current edits are kept in history but no longer editable.`
          : undefined
      }
    >
      {replacing ? `Restart DXV Review Draft ${draftNumber} from AI Draft ${aiNumber}` : `Start DXV Review Draft ${draftNumber}`}
    </ActionButton>
  );
}

export function ReviseIssueButton({ memoVersionId, draftName }: { memoVersionId: string; draftName: string }) {
  return (
    <ActionButton run={() => reviseIssue(memoVersionId)} variant="secondary">
      Revise as {draftName}
    </ActionButton>
  );
}

const joinLines = (items: string[]) => items.join("\n");

/** Every text section of the review copy. One line per bullet; commas between tags. */
export function MemoTextForm({ draftId, m, version }: { draftId: string; m: MemoContent; version: string }) {
  const area = (name: string, value: string, rows = 3) => (
    <textarea name={name} defaultValue={value} rows={rows} className={inputClass} />
  );
  return (
    <ActionForm key={version} action={saveMemoText.bind(null, draftId)} resetOnSuccess={false} className="space-y-5">
      <fieldset className="grid gap-3 rounded-lg border border-black/10 bg-dxv-green/[0.03] p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">Header</legend>
        <Field label="Business name">
          <input name="businessName" defaultValue={m.header.businessName} className={inputClass} />
        </Field>
        <Field label="Round">
          <input name="round" defaultValue={m.header.round} className={inputClass} />
        </Field>
        <Field label="Stage">
          <input name="stage" defaultValue={m.header.stage} className={inputClass} />
        </Field>
        <Field label="Business model">
          <input name="businessModel" defaultValue={m.header.businessModel} className={inputClass} />
        </Field>
        <Field label="SDGs" hint="One per line">
          {area("sdgs", joinLines(m.header.sdgs), 2)}
        </Field>
        <Field label="Impact thesis">{area("impactThesis", m.header.impactThesis, 2)}</Field>
        <Field label="Impact themes" hint="Comma-separated, e.g. Health, Social Mobility">
          <input name="impactThemes" defaultValue={m.header.impactThemes.join(", ")} className={inputClass} />
        </Field>
        <Field label="Diversity themes" hint="Only where the founder has stated it. Comma-separated.">
          <input name="diversityThemes" defaultValue={m.header.diversityThemes.join(", ")} className={inputClass} />
        </Field>
      </fieldset>

      <Field label="Executive summary">{area("executiveSummary", m.executiveSummary, 5)}</Field>
      <Field label="Investment case" hint="One bullet per line">
        {area("investmentCase", joinLines(m.investmentCase), 6)}
      </Field>
      <Field label="Conclusion">{area("conclusion", m.conclusion, 2)}</Field>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">SWOT (one per line)</legend>
        <Field label="Strengths">{area("strengths", joinLines(m.swot.strengths), 4)}</Field>
        <Field label="Weaknesses">{area("weaknesses", joinLines(m.swot.weaknesses), 4)}</Field>
        <Field label="Opportunities">{area("opportunities", joinLines(m.swot.opportunities), 4)}</Field>
        <Field label="Threats">{area("threats", joinLines(m.swot.threats), 4)}</Field>
      </fieldset>

      <Field label="Key follow-up questions for founders" hint="One per line">
        {area("followUpQuestions", joinLines(m.followUpQuestions), 5)}
      </Field>

      <SubmitButton>Save draft</SubmitButton>
    </ActionForm>
  );
}

/** One editable row of the scoring table. Changes are logged with an optional reason. */
export function ScoreRow({ draftId, s, ai, version }: { draftId: string; s: MemoScore; ai?: MemoScore; version: string }) {
  const [score, setScore] = useState(s.score);
  const changedFromAi = ai && ai.score !== s.score;
  return (
    <li className={`rounded-lg border p-3 ${changedFromAi ? "border-dxv-yellow bg-dxv-yellow/10" : "border-black/10"}`}>
      <ActionForm key={version} action={saveMemoScore.bind(null, draftId)} resetOnSuccess={false} className="space-y-2">
        <input type="hidden" name="criterion" value={s.criterion} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{s.criterion}</span>
          <span className="flex items-center gap-2 text-xs text-black/55">
            {ai && (
              <span className="flex items-center gap-1" title="The AI's original score">
                AI <ScoreBadge score={ai.score} />
              </span>
            )}
            <label className="flex items-center gap-1">
              Score
              <select
                name="score"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className={`${inputClass} w-auto py-1`}
                aria-label={`${s.criterion} score`}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </span>
        </div>
        <textarea name="justification" defaultValue={s.justification} rows={2} className={inputClass} aria-label={`${s.criterion} justification`} />
        <div className="flex flex-wrap items-center gap-2">
          <input name="reason" placeholder="Reason for change (optional, logged)" className={`${inputClass} flex-1`} />
          <SubmitButton variant="secondary">Save score</SubmitButton>
        </div>
      </ActionForm>
    </li>
  );
}

export function FinaliseForm({ draftId, issueName }: { draftId: string; issueName: string }) {
  return (
    <ActionForm action={finaliseMemo.bind(null, draftId)} className="space-y-3">
      <Field label="Issue note (optional)" hint="e.g. Reviewed by Blue and Anna, Round 3 pitch">
        <input name="summary" className={inputClass} />
      </Field>
      <SubmitButton>Mark complete: release {issueName}</SubmitButton>
    </ActionForm>
  );
}
