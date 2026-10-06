"use client";

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmailPreview } from "@/components/email-preview";
import { Field, inputClass } from "@/components/ui";
import { templateProblems } from "@/lib/member-email";
import { archiveTemplate, saveTemplate } from "../../actions";
import { WritingHelp } from "../../writing-help";

// The boxes are uncontrolled (defaultValue): typing before the page finishes loading can't
// be lost or doubled; onChange keeps the live preview in step.
export function TemplateForm({
  id,
  keyed,
  bulk,
  initial,
}: {
  id: string | null;
  /** Used by DXV OS itself (welcome, founder emails): edited, never archived. */
  keyed: boolean;
  /** A bulk email to angels (previewed with the unsubscribe line). */
  bulk: boolean;
  initial: { name: string; subject: string; body: string };
}) {
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const problems = templateProblems({ subject, body });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <ActionForm action={saveTemplate.bind(null, id)} resetOnSuccess={false} className="space-y-3">
          <Field label="Template name (only the team sees it)">
            <input name="name" required defaultValue={initial.name} className={inputClass} />
          </Field>
          <Field label="Subject">
            <input name="subject" required defaultValue={initial.subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Message">
            <textarea name="body" required rows={20} defaultValue={initial.body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} font-mono text-[13px] leading-relaxed`} />
          </Field>
          {problems.length > 0 && (
            <ul className="space-y-1 rounded bg-dxv-yellow/30 px-3 py-2 text-sm">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <SubmitButton>{id ? "Save template" : "Create template"}</SubmitButton>
        </ActionForm>
        <WritingHelp />
        {id && !keyed && (
          <ActionButton variant="secondary" confirm="Archive this template? Emails already sent keep their words." pendingLabel="Archiving…" run={() => archiveTemplate(id)}>
            Archive template
          </ActionButton>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-black/70">Preview (as Ada would see it)</p>
        <EmailPreview subject={subject} body={body} firstName="Ada" link="https://example.com/your-own-link" bulk={bulk} />
      </div>
    </div>
  );
}
