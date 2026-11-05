"use client";

// Write one email to the founders of several deals: choose the deals (round, stages,
// declined or not; untick any), write or start from a starter, insert the next pitch
// session, attach files, send a test, then send.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { EmailPreview } from "@/components/email-preview";
import { Field, Spinner, buttonClass, inputClass } from "@/components/ui";
import { founderFirstName } from "@/lib/founder-intake";
import { founderEmailProblems } from "@/lib/member-email";
import { BOARD_STAGES, founderAudience, pitchSessionText, stageLabel } from "@/lib/pipeline";
import { actionErrorMessage } from "@/lib/stale-version";
import type { Stage } from "@/generated/prisma/enums";
import { Attachments } from "../../../angels/emails/new/attachments";
import type { DraftAttachment } from "../../../angels/emails/attachment-actions";
import { createFounderBulkEmail, sendFounderTestEmail } from "../actions";

export type AudienceDeal = { id: string; name: string; founderNames: string | null; founderEmail: string | null; currentStage: Stage; round: number | null };
type Starter = { id: string; name: string; subject: string; body: string };
type Session = { title: string; startsAt: string; location: string; lumaUrl: string | null };

const SESSION_SLOT = "PASTE-SESSION-DETAILS";

export function FounderComposer({
  deals,
  rounds,
  defaultRound,
  starters,
  session,
  myEmail,
}: {
  deals: AudienceDeal[];
  rounds: number[];
  defaultRound: number | null;
  starters: Starter[];
  session: Session | null;
  myEmail: string;
}) {
  const router = useRouter();
  const [round, setRound] = useState<number | null>(defaultRound);
  const [stages, setStages] = useState<Stage[]>([]);
  const [includeDeclined, setIncludeDeclined] = useState(false);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [boxes, setBoxes] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [pending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filter = { round, stages, includeDeclined };
  const audience = useMemo(() => founderAudience(deals, { round, stages, includeDeclined }), [deals, round, stages, includeDeclined]);
  const chosen = audience.send.filter((v) => !unticked.has(v.id));
  const problems = founderEmailProblems({ subject, body });
  const sample = chosen[0];
  const resetTicks = () => setUnticked(new Set());
  const toggleStage = (s: Stage) => {
    setStages((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
    resetTicks();
  };
  const toggle = (id: string) =>
    setUnticked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function insertSession() {
    if (!session) return;
    const text = pitchSessionText({ ...session, startsAt: new Date(session.startsAt) });
    const el = bodyRef.current;
    const current = el?.value ?? body;
    let next: string;
    if (current.includes(SESSION_SLOT)) next = current.replace(SESSION_SLOT, text);
    else {
      const at = el?.selectionStart ?? current.length;
      next = `${current.slice(0, at)}${text}${current.slice(at)}`;
    }
    if (el) el.value = next;
    setBody(next);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">1. Which deals</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Round">
              <select
                className={`${inputClass} w-auto`}
                value={round ?? ""}
                onChange={(e) => {
                  setRound(e.target.value ? Number(e.target.value) : null);
                  resetTicks();
                }}
              >
                <option value="">All rounds</option>
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Round {r}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={includeDeclined}
                onChange={(e) => {
                  setIncludeDeclined(e.target.checked);
                  resetTicks();
                }}
                className="accent-dxv-green"
              />
              Include declined deals
            </label>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-black/55">Stages (none chosen = every live stage)</p>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_STAGES.map((s) => {
                const on = stages.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleStage(s.key)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? "border-dxv-green bg-dxv-green text-white" : "border-black/15 bg-white text-black/70 hover:border-dxv-green"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <details className="text-sm" open={audience.send.length <= 12}>
            <summary className="cursor-pointer text-dxv-green">
              {chosen.length} of {audience.send.length} {audience.send.length === 1 ? "deal" : "deals"} chosen (untick any to leave them out)
            </summary>
            {audience.send.length === 0 ? (
              <p className="mt-2 text-black/55">No deals with a founder email match.</p>
            ) : (
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {audience.send.map((v) => (
                  <li key={v.id}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={!unticked.has(v.id)} onChange={() => toggle(v.id)} className="mt-1 accent-dxv-green" />
                      <span className="min-w-0">
                        <span className="font-medium">{v.name}</span> <span className="text-xs text-black/50">{stageLabel(v.currentStage)}</span>
                        <span className="block break-all text-xs text-black/55">
                          {v.founderNames ? `${v.founderNames} · ` : ""}
                          {v.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </details>
          {audience.noEmail.length > 0 && (
            <p className="rounded bg-dxv-yellow/30 px-3 py-2 text-xs">
              Left out, no usable founder email (add one in the deal&apos;s Details → Edit venture details): {audience.noEmail.map((v) => v.name).join(", ")}.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">2. The email</h2>
          <Field label="Start from">
            <select
              className={inputClass}
              defaultValue=""
              onChange={(e) => {
                const t = starters.find((x) => x.id === e.target.value);
                if (t && (!body.trim() || window.confirm("Replace what you've written with this starting point?"))) {
                  setSubject(t.subject);
                  setBody(t.body);
                  setBoxes((n) => n + 1);
                }
              }}
            >
              <option value="">Choose…</option>
              {starters.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input key={`s${boxes}`} defaultValue={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Message">
            <textarea
              key={`b${boxes}`}
              ref={bodyRef}
              rows={16}
              defaultValue={body}
              onChange={(e) => setBody(e.target.value)}
              className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {session ? (
              <>
                <button type="button" className={buttonClass("secondary")} onClick={insertSession}>
                  Insert next pitch session
                </button>
                <span className="text-xs text-black/55">
                  {session.title}, {new Date(session.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}
                </span>
              </>
            ) : (
              <span className="text-xs text-black/55">
                No pitch session scheduled: add one on{" "}
                <Link href="/angels/events" className="text-dxv-green underline">
                  Angels → Events
                </Link>{" "}
                to insert its details.
              </span>
            )}
          </div>
          <details className="rounded-md border border-black/10 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-dxv-green">How to write it: names, links and spacing</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-black/75">
              <li>
                <code className="rounded bg-black/5 px-1">{"{{first_name}}"}</code> becomes the first founder&apos;s first name;{" "}
                <code className="rounded bg-black/5 px-1">{"{{company}}"}</code> the company.
              </li>
              <li>
                Links: <code className="rounded bg-black/5 px-1">[link text](https://…)</code>. A plain https:// address is linked too.
              </li>
              <li>A blank line starts a new paragraph; a single line break stays as it is.</li>
              <li>Each founder gets their own copy (they don&apos;t see each other), kept on their deal under Founder comms.</li>
            </ul>
          </details>
          {problems.length > 0 && (subject || body) && (
            <ul className="space-y-1 rounded bg-dxv-yellow/30 px-3 py-2 text-sm">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">3. Attachments (optional)</h2>
          <Attachments value={attachments} onChange={setAttachments} packs={[]} />
        </section>

        <section className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">4. Check and send</h2>
          <ActionButton
            variant="secondary"
            pendingLabel="Sending test…"
            run={() => sendFounderTestEmail({ subject, body, attachmentIds: attachments.map((a) => a.id), sampleCompany: sample?.name })}
          >
            Send me a test ({myEmail})
          </ActionButton>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || problems.length > 0 || chosen.length === 0}
              className={buttonClass()}
              onClick={() => {
                if (!window.confirm(`Send "${subject}" to the founders of ${chosen.length} ${chosen.length === 1 ? "deal" : "deals"} now?`)) return;
                startSend(async () => {
                  setError(null);
                  try {
                    const res = await createFounderBulkEmail({
                      subject,
                      body,
                      filter,
                      ventureIds: chosen.map((v) => v.id),
                      attachmentIds: attachments.map((a) => a.id),
                    });
                    if ("error" in res) setError(res.error);
                    else router.push(`/deals/founder-emails/${res.id}?send=1`);
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
                `Send to ${chosen.length} ${chosen.length === 1 ? "founder" : "founders"}`
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
      <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
        <p className="text-sm font-medium text-black/70">Preview{sample ? ` (as ${sample.name} would see it)` : ""}</p>
        <EmailPreview
          subject={subject}
          body={body}
          firstName={sample ? founderFirstName(sample.founderNames) : "Ada"}
          company={sample?.name ?? "Example Ltd"}
          bulk={false}
        />
      </div>
    </div>
  );
}
