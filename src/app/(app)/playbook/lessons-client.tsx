"use client";

// One lesson: approve (AI suggestions), edit in place, archive or restore. Nothing is deleted.

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RevealContext } from "@/components/reveal";
import { Field, inputClass } from "@/components/ui";
import type { LessonScope } from "@/generated/prisma/enums";
import { SCOPE_LABELS } from "@/lib/playbook/labels";
import { approveLesson, archiveLesson, updateLesson } from "./actions";


export function LessonFields({ title = "", body = "", scope = "GENERAL" }: { title?: string; body?: string; scope?: LessonScope }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <Field label="Lesson *">
          <input name="title" required defaultValue={title} placeholder="e.g. Ask for the cap table before pitch selection" className={inputClass} />
        </Field>
        <Field label="Applies to" hint="Eligibility and assessment lessons are given to that AI step">
          <select name="scope" defaultValue={scope} className={inputClass}>
            {Object.entries(SCOPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What we learned *" hint="Specific enough for the AI (and a new team member) to act on">
        <textarea name="body" required rows={3} defaultValue={body} className={inputClass} />
      </Field>
    </div>
  );
}

export function LessonActions({ id, title, body, scope, status }: { id: string; title: string; body: string; scope: LessonScope; status: "SUGGESTED" | "APPROVED" | "ARCHIVED" }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <RevealContext.Provider value={{ close: () => setEditing(false) }}>
        <div className="mt-2 w-full rounded-lg border border-dxv-green/20 bg-dxv-green/[0.03] p-3">
          <ActionForm action={updateLesson.bind(null, id)} resetOnSuccess={false} className="space-y-3">
            <LessonFields title={title} body={body} scope={scope} />
            <SubmitButton>Save lesson</SubmitButton>
          </ActionForm>
        </div>
      </RevealContext.Provider>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status === "SUGGESTED" && (
        <ActionButton run={approveLesson.bind(null, id)} pendingLabel="Approving…">
          Approve
        </ActionButton>
      )}
      {status === "ARCHIVED" ? (
        <ActionButton run={approveLesson.bind(null, id)} variant="secondary" pendingLabel="Restoring…">
          Restore
        </ActionButton>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="rounded px-2 py-1 text-sm text-dxv-green transition hover:bg-dxv-green/10">
          Edit
        </button>
      )}
      {status !== "ARCHIVED" && (
        <ActionButton run={archiveLesson.bind(null, id)} variant="secondary" pendingLabel="Archiving…">
          {status === "SUGGESTED" ? "Dismiss" : "Archive"}
        </ActionButton>
      )}
    </span>
  );
}
