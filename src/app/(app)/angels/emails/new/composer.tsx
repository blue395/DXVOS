"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { EmailPreview } from "@/components/email-preview";
import { Field, Spinner, buttonClass, inputClass } from "@/components/ui";
import { templateProblems } from "@/lib/member-email";
import { actionErrorMessage } from "@/lib/stale-version";
import { createMemberEmail, sendTestEmail } from "../actions";
import type { Audience } from "../audience";
import { WritingHelp } from "../writing-help";

type Template = { id: string; name: string; subject: string; body: string };

export function Composer({
  templates,
  audiences,
  start,
  myEmail,
  myFirstName,
}: {
  templates: Template[];
  audiences: Audience[];
  start: Template | null;
  myEmail: string;
  myFirstName: string;
}) {
  const router = useRouter();
  const [audienceKey, setAudienceKey] = useState<Audience["key"]>("members-not-on-platform");
  const audience = audiences.find((a) => a.key === audienceKey)!;
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(start?.subject ?? "");
  const [body, setBody] = useState(start?.body ?? "");
  // The boxes are uncontrolled (typing before the page finishes loading can't be lost or
  // doubled); choosing a template remounts them with its words.
  const [boxes, setBoxes] = useState(0);
  const [pending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chosen = useMemo(() => audience.people.filter((p) => !unticked.has(p.id)), [audience, unticked]);
  const problems = templateProblems({ subject, body });
  const sample = chosen[0];
  const toggle = (id: string) =>
    setUnticked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <section className="space-y-2 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">1. Who it&apos;s for</h2>
          <div className="space-y-1.5">
            {audiences.map((a) => (
              <label key={a.key} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${a.key === audienceKey ? "border-dxv-green bg-dxv-green/[0.04]" : "border-black/10"}`}>
                <input
                  type="radio"
                  name="audience"
                  checked={a.key === audienceKey}
                  onChange={() => {
                    setAudienceKey(a.key);
                    setUnticked(new Set());
                  }}
                  className="mt-0.5 accent-dxv-green"
                />
                <span>
                  <strong>{a.label}</strong> <span className="text-black/55">({a.people.length})</span>
                  <span className="block text-xs text-black/55">{a.note}</span>
                </span>
              </label>
            ))}
          </div>
          {(audience.noEmail > 0 || audience.optedOut > 0) && (
            <p className="text-xs text-black/55">
              Left out: {audience.noEmail > 0 && `${audience.noEmail} with no email`}
              {audience.noEmail > 0 && audience.optedOut > 0 && ", "}
              {audience.optedOut > 0 && `${audience.optedOut} unsubscribed`}.
            </p>
          )}
          <details className="text-sm" open={audience.people.length <= 12}>
            <summary className="cursor-pointer text-dxv-green">
              {chosen.length} of {audience.people.length} chosen (untick anyone to leave them out)
            </summary>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {audience.people.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!unticked.has(p.id)} onChange={() => toggle(p.id)} className="accent-dxv-green" />
                    <span>
                      {p.name} <span className="text-black/50">{p.email}</span>
                      {!p.hasLogin && <span className="ml-1 text-xs text-black/50">· gets a sign-up link</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">2. The email</h2>
          {templates.length > 0 && (
            <Field label="Start from a template">
              <select
                className={inputClass}
                defaultValue={start?.id ?? ""}
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t && (!body.trim() || window.confirm("Replace what you've written with this template?"))) {
                    setSubject(t.subject);
                    setBody(t.body);
                    setBoxes((n) => n + 1);
                  }
                }}
              >
                <option value="">Choose…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Subject">
            <input key={`s${boxes}`} defaultValue={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Message">
            <textarea key={`b${boxes}`} rows={18} defaultValue={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} font-mono text-[13px] leading-relaxed`} />
          </Field>
          <WritingHelp />
          {problems.length > 0 && (subject || body) && (
            <ul className="space-y-1 rounded bg-dxv-yellow/30 px-3 py-2 text-sm">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">3. Check and send</h2>
          <ActionButton variant="secondary" pendingLabel="Sending test…" run={() => sendTestEmail({ subject, body })}>
            Send me a test ({myEmail})
          </ActionButton>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || problems.length > 0 || chosen.length === 0}
              className={buttonClass()}
              onClick={() => {
                if (!window.confirm(`Send "${subject}" to ${chosen.length} ${chosen.length === 1 ? "angel" : "angels"} now?`)) return;
                startSend(async () => {
                  setError(null);
                  try {
                    const res = await createMemberEmail({ subject, body, audience: audienceKey, angelIds: chosen.map((p) => p.id) });
                    if ("error" in res) setError(res.error);
                    else router.push(`/angels/emails/${res.id}?send=1`);
                  } catch (e) {
                    setError(actionErrorMessage(e));
                  }
                });
              }}
            >
              {pending ? (
                <>
                  <Spinner /> Preparing…
                </>
              ) : (
                `Send to ${chosen.length} ${chosen.length === 1 ? "angel" : "angels"}`
              )}
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-sm">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <p className="text-sm font-medium text-black/70">Preview{sample ? ` (as ${sample.name.split(" ")[0]} would see it)` : ""}</p>
        <EmailPreview subject={subject} body={body} firstName={sample ? sample.name.split(" ")[0] : myFirstName} link="https://example.com/their-own-link" bulk />
      </div>
    </div>
  );
}
