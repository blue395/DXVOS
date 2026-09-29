"use client";

// Editors for the Playbook criteria. Changes stay on this page until "Save as version N",
// which records a new version (with a note) that the AI uses from its next run.

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import type { PlaybookKind } from "@/generated/prisma/enums";
import { buildMemoPrompt, buildScreeningPrompt } from "@/lib/playbook/prompts";
import type { AssessmentPlaybook, EligibilityPlaybook } from "@/lib/playbook/schema";
import { savePlaybook } from "./actions";

const smallButton =
  "cursor-pointer rounded px-1.5 py-0.5 text-xs text-dxv-green transition hover:bg-dxv-green/10 disabled:cursor-not-allowed disabled:opacity-30";
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const newId = () => Math.random().toString(36).slice(2, 10);

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Shared frame: change note, save, discard, and a preview of the prompt the AI will get. */
function EditorFrame({
  kind,
  nextVersion,
  content,
  dirty,
  onDiscard,
  preview,
  lessonCount,
  children,
}: {
  kind: PlaybookKind;
  nextVersion: number;
  content: unknown;
  dirty: boolean;
  onDiscard: () => void;
  preview: string;
  lessonCount: number;
  children: React.ReactNode;
}) {
  return (
    <ActionForm action={savePlaybook.bind(null, kind)} resetOnSuccess className="space-y-5">
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      {children}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-end gap-3 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-64 flex-1">
          <Field label="What changed and why *" hint="Kept in the version history">
            <input name="note" required placeholder="e.g. Added UK-registered company as a criterion" className={inputClass} />
          </Field>
        </div>
        <SubmitButton pendingLabel="Saving…" doneLabel={`Saved as version ${nextVersion}`}>
          Save as version {nextVersion}
        </SubmitButton>
        {dirty && (
          <button type="button" onClick={onDiscard} className="rounded px-2 py-1.5 text-sm text-black/60 transition hover:bg-black/5 hover:text-black">
            Discard changes
          </button>
        )}
        {dirty && <span className="w-full text-xs text-black/55">Unsaved changes. The AI keeps using the current version until you save.</span>}
      </div>
      <details className="rounded-lg border border-black/10 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-dxv-green">Preview the prompt the AI will get</summary>
        <p className="mt-2 text-xs text-black/55">
          Built from the criteria above{lessonCount ? `, plus ${lessonCount} approved lesson${lessonCount === 1 ? "" : "s"} (Lessons tab)` : ""}.
        </p>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-black/[0.03] p-3 text-xs leading-relaxed">{preview}</pre>
      </details>
    </ActionForm>
  );
}

function CriterionControls({ i, count, onMove, onRemove, removable, removeTitle }: { i: number; count: number; onMove: (by: -1 | 1) => void; onRemove: () => void; removable: boolean; removeTitle?: string }) {
  return (
    <span className="flex items-center gap-1">
      <button type="button" className={smallButton} disabled={i === 0} onClick={() => onMove(-1)} aria-label="Move up">
        ↑
      </button>
      <button type="button" className={smallButton} disabled={i === count - 1} onClick={() => onMove(1)} aria-label="Move down">
        ↓
      </button>
      <button type="button" className={`${smallButton} text-black/55`} disabled={!removable} title={removeTitle} onClick={onRemove}>
        Remove
      </button>
    </span>
  );
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export function EligibilityEditor({ initial, nextVersion, lessonCount }: { initial: EligibilityPlaybook; nextVersion: number; lessonCount: number }) {
  const [p, setP] = useState(initial);
  const [houseStyle, setHouseStyle] = useState(initial.houseStyle.join("\n"));
  const content: EligibilityPlaybook = useMemo(() => ({ ...p, houseStyle: lines(houseStyle) }), [p, houseStyle]);
  const dirty = JSON.stringify(content) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<EligibilityPlaybook["criteria"][number]>) =>
    setP({ ...p, criteria: p.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <EditorFrame
      kind="ELIGIBILITY"
      nextVersion={nextVersion}
      content={content}
      dirty={dirty}
      lessonCount={lessonCount}
      preview={buildScreeningPrompt(content)}
      onDiscard={() => {
        setP(initial);
        setHouseStyle(initial.houseStyle.join("\n"));
      }}
    >
      <Field label="Purpose of the screen" hint="How the AI is briefed before the criteria">
        <textarea rows={3} value={p.intro} onChange={(e) => setP({ ...p, intro: e.target.value })} className={inputClass} />
      </Field>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Criteria ({p.criteria.length})</h3>
        {p.criteria.map((c, i) => (
          <div key={c.id} className="space-y-2 rounded-lg border border-black/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-sm font-semibold text-dxv-green">{i + 1}.</span>
              <input value={c.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Criterion name" className={`${inputClass} flex-1 font-medium`} />
              {c.core && (
                <span className="rounded-full bg-dxv-green/10 px-2 py-0.5 text-[11px] font-medium text-dxv-green" title="A core criterion: the screen has its own field for it. Reword it freely; it can't be removed.">
                  Core
                </span>
              )}
              <CriterionControls
                i={i}
                count={p.criteria.length}
                onMove={(by) => setP({ ...p, criteria: move(p.criteria, i, by) })}
                onRemove={() => setP({ ...p, criteria: p.criteria.filter((_, j) => j !== i) })}
                removable={!c.core}
                removeTitle={c.core ? "Core criteria can be reworded but not removed" : "Remove this criterion"}
              />
            </div>
            <textarea rows={3} value={c.guidance} onChange={(e) => set(i, { guidance: e.target.value })} aria-label={`${c.name} guidance`} className={inputClass} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setP({ ...p, criteria: [...p.criteria, { id: newId(), name: "New criterion", guidance: "What the AI should check, and what counts as met or not met." }] })}
          className="rounded-md border border-dashed border-dxv-green/40 px-3 py-1.5 text-sm text-dxv-green transition hover:border-dxv-green hover:bg-dxv-green/5"
        >
          + Add criterion
        </button>
        <p className="text-xs text-black/55">Added criteria are assessed in the screen&apos;s &quot;additional criteria&quot; list (met, not met or unclear, and why).</p>
      </div>
      <Field label="House style" hint="One rule per line">
        <textarea rows={4} value={houseStyle} onChange={(e) => setHouseStyle(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Closing instruction">
        <textarea rows={2} value={p.closing} onChange={(e) => setP({ ...p, closing: e.target.value })} className={inputClass} />
      </Field>
    </EditorFrame>
  );
}

// ── Investment assessment ───────────────────────────────────────────────────

export function AssessmentEditor({ initial, nextVersion, lessonCount }: { initial: AssessmentPlaybook; nextVersion: number; lessonCount: number }) {
  const [p, setP] = useState(initial);
  const [text, setText] = useState({
    houseStyle: initial.houseStyle.join("\n"),
    impactThemes: initial.impactThemes.join("\n"),
    diversityThemes: initial.diversityThemes.join("\n"),
  });
  const content: AssessmentPlaybook = useMemo(
    () => ({ ...p, houseStyle: lines(text.houseStyle), impactThemes: lines(text.impactThemes), diversityThemes: lines(text.diversityThemes) }),
    [p, text],
  );
  const dirty = JSON.stringify(content) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<AssessmentPlaybook["criteria"][number]>) =>
    setP({ ...p, criteria: p.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <EditorFrame
      kind="ASSESSMENT"
      nextVersion={nextVersion}
      content={content}
      dirty={dirty}
      lessonCount={lessonCount}
      preview={buildMemoPrompt(content)}
      onDiscard={() => {
        setP(initial);
        setText({ houseStyle: initial.houseStyle.join("\n"), impactThemes: initial.impactThemes.join("\n"), diversityThemes: initial.diversityThemes.join("\n") });
      }}
    >
      <Field label="Purpose of the assessment" hint="How the AI is briefed">
        <textarea rows={3} value={p.intro} onChange={(e) => setP({ ...p, intro: e.target.value })} className={inputClass} />
      </Field>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">
          Scoring criteria ({p.criteria.length}, scored out of {p.criteria.length * 5})
        </h3>
        <p className="text-xs text-black/55">
          Each is scored 1 to 5 against its anchors. Adding, removing or renaming changes future assessments only: every memo keeps the criteria it was
          scored against.
        </p>
        {p.criteria.map((c, i) => (
          <div key={c.id} className="space-y-2 rounded-lg border border-black/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-sm font-semibold text-dxv-green">{i + 1}.</span>
              <input value={c.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Criterion name" className={`${inputClass} flex-1 font-medium`} />
              <CriterionControls
                i={i}
                count={p.criteria.length}
                onMove={(by) => setP({ ...p, criteria: move(p.criteria, i, by) })}
                onRemove={() => setP({ ...p, criteria: p.criteria.filter((_, j) => j !== i) })}
                removable={p.criteria.length > 1}
                removeTitle="Remove this criterion"
              />
            </div>
            <textarea
              rows={3}
              value={c.anchors}
              onChange={(e) => set(i, { anchors: e.target.value })}
              aria-label={`${c.name} scoring anchors`}
              placeholder="1: … 3: … 5: …"
              className={inputClass}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setP({ ...p, criteria: [...p.criteria, { id: newId(), name: "New criterion", anchors: "1: … 3: … 5: …" }] })}
          className="rounded-md border border-dashed border-dxv-green/40 px-3 py-1.5 text-sm text-dxv-green transition hover:border-dxv-green hover:bg-dxv-green/5"
        >
          + Add criterion
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Impact themes" hint="One per line">
          <textarea rows={6} value={text.impactThemes} onChange={(e) => setText({ ...text, impactThemes: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Diversity themes" hint="One per line">
          <textarea rows={6} value={text.diversityThemes} onChange={(e) => setText({ ...text, diversityThemes: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label="Taxonomy rule" hint="How the tags may be applied">
        <textarea rows={4} value={p.taxonomyGuidance} onChange={(e) => setP({ ...p, taxonomyGuidance: e.target.value })} className={inputClass} />
      </Field>
      <Field label="House style" hint="One rule per line">
        <textarea rows={4} value={text.houseStyle} onChange={(e) => setText({ ...text, houseStyle: e.target.value })} className={inputClass} />
      </Field>
    </EditorFrame>
  );
}
