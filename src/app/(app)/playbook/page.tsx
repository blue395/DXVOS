import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, Field, formatDate, formatDateTime, inputClass } from "@/components/ui";
import type { LessonStatus, PlaybookKind } from "@/generated/prisma/enums";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvedLessonsFor, currentPlaybook } from "@/lib/playbook/current";
import { DEFAULT_ASSESSMENT, DEFAULT_ELIGIBILITY } from "@/lib/playbook/defaults";
import { SCOPE_LABELS } from "@/lib/playbook/labels";
import type { AssessmentPlaybook, EligibilityPlaybook } from "@/lib/playbook/schema";
import { addLesson, restorePlaybook } from "./actions";
import { AssessmentEditor, EligibilityEditor } from "./criteria-editor";
import { LessonActions, LessonFields } from "./lessons-client";

type Tab = "eligibility" | "assessment" | "lessons";
const TABS: { key: Tab; label: string }[] = [
  { key: "eligibility", label: "Eligibility criteria" },
  { key: "assessment", label: "Investment assessment" },
  { key: "lessons", label: "Lessons" },
];
const STATUS_TABS: { key: LessonStatus; label: string }[] = [
  { key: "SUGGESTED", label: "Suggested" },
  { key: "APPROVED", label: "Approved" },
  { key: "ARCHIVED", label: "Archived" },
];

export default async function PlaybookPage({ searchParams }: PageProps<"/playbook">) {
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "eligibility";

  const lessonCounts = await requireAdminWith(() => db.lesson.groupBy({ by: ["status"], _count: { _all: true } }));
  const count = (s: LessonStatus) => lessonCounts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Playbook</h1>
        <p className="text-sm text-black/60">
          How DXV assesses deals, and what it has learned. The AI eligibility screen and investment assessment use the latest version of these
          criteria and the approved lessons; every change is versioned. This is also the knowledge base for the DXV Brain.
        </p>
      </div>
      <nav aria-label="Playbook sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/playbook?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              tab === t.key ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
            }`}
          >
            {t.label}
            {t.key === "lessons" && count("SUGGESTED") > 0 && (
              <span className="ml-1.5 rounded-full bg-dxv-yellow px-1.5 text-xs font-medium text-dxv-green">{count("SUGGESTED")} suggested</span>
            )}
          </Link>
        ))}
      </nav>
      {tab === "lessons" ? (
        <LessonsTab status={STATUS_TABS.some((s) => s.key === params.status) ? (params.status as LessonStatus) : count("SUGGESTED") ? "SUGGESTED" : "APPROVED"} count={count} />
      ) : (
        <CriteriaTab kind={tab === "eligibility" ? "ELIGIBILITY" : "ASSESSMENT"} />
      )}
    </div>
  );
}

async function CriteriaTab({ kind }: { kind: PlaybookKind }) {
  const [current, versions, lessons] = await Promise.all([
    kind === "ELIGIBILITY" ? currentPlaybook("ELIGIBILITY") : currentPlaybook("ASSESSMENT"),
    db.playbookVersion.findMany({ where: { kind }, orderBy: { version: "desc" }, include: { createdBy: { select: { name: true } } } }),
    approvedLessonsFor(kind),
  ]);
  const nextVersion = (versions[0]?.version ?? 0) + 1;
  const names = (content: unknown) => ((content as { criteria?: { name: string }[] }).criteria ?? []).map((c) => c.name);
  const history = [
    ...versions.map((v) => ({ version: v.version, note: v.note, by: v.createdBy.name, at: v.createdAt as Date | null, criteria: names(v.content) })),
    { version: 0, note: "DXV's original document", by: null as string | null, at: null as Date | null, criteria: names(kind === "ELIGIBILITY" ? DEFAULT_ELIGIBILITY : DEFAULT_ASSESSMENT) },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card title={`${kind === "ELIGIBILITY" ? "Eligibility criteria" : "Investment assessment criteria"}: version ${current.version}`}>
        <p className="mb-4 text-sm text-black/60">
          {current.version === 0
            ? "DXV's original document. Edit below and save to create version 1."
            : `Saved by ${current.createdBy} on ${formatDateTime(current.createdAt!)}${current.note ? `: "${current.note}"` : ""}.`}{" "}
          The AI uses this version from its next run; screens and memos already produced keep the version they used.
        </p>
        {kind === "ELIGIBILITY" ? (
          <EligibilityEditor key={current.version} initial={current.content as EligibilityPlaybook} nextVersion={nextVersion} lessonCount={lessons.length} />
        ) : (
          <AssessmentEditor key={current.version} initial={current.content as AssessmentPlaybook} nextVersion={nextVersion} lessonCount={lessons.length} />
        )}
      </Card>
      <Card title="Version history">
        <ol className="space-y-3 text-sm">
          {history.map((h) => (
            <li key={h.version} className={`rounded-md border p-2.5 ${h.version === current.version ? "border-dxv-green bg-dxv-green/[0.04]" : "border-black/10"}`}>
              <p className="flex items-center justify-between gap-2">
                <strong className="text-dxv-green">Version {h.version}</strong>
                {h.version === current.version && <span className="rounded-full bg-dxv-yellow px-2 py-px text-[11px] font-medium text-dxv-green">In use</span>}
              </p>
              {h.note && <p className="text-black/70">{h.note}</p>}
              <p className="text-xs text-black/45">{h.by && h.at ? `${h.by}, ${formatDateTime(h.at)}` : "Built in"}</p>
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-dxv-green">{h.criteria.length} criteria</summary>
                <ol className="mt-1 list-decimal pl-5 text-black/70">
                  {h.criteria.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ol>
              </details>
              {h.version !== current.version && (
                <div className="mt-2">
                  <ActionButton
                    run={restorePlaybook.bind(null, kind, h.version)}
                    variant="secondary"
                    pendingLabel="Restoring…"
                    confirm={`Make version ${h.version} current again? It's saved as version ${nextVersion}; nothing is lost.`}
                  >
                    Restore
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

async function LessonsTab({ status, count }: { status: LessonStatus; count: (s: LessonStatus) => number }) {
  const [lessons, ventures] = await Promise.all([
    db.lesson.findMany({
      where: { status },
      orderBy: status === "APPROVED" ? [{ approvedAt: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      include: {
        venture: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    db.venture.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3 text-sm text-black/65">
          <p>
            <strong className="text-dxv-green">The feedback loop.</strong> Add what DXV learns from deals. The AI also suggests lessons when a deal is
            declined, when the team changes the AI&apos;s scores before issuing a memo, and when an eligibility decision differs from the AI&apos;s
            recommendation. Suggestions wait here until one of you approves them.
          </p>
          <p>
            Approved lessons marked <em>Eligibility screen</em>, <em>Investment assessment</em> or <em>General</em> are given to those AI steps from their
            next run (the newest 40). All lessons form the DXV Brain&apos;s knowledge base.
          </p>
        </div>
        <div className="mt-4 border-t border-black/10 pt-4">
          <Reveal label="+ Add lesson">
            <ActionForm action={addLesson} className="space-y-3">
              <LessonFields />
              <Field label="From deal (optional)">
                <select name="ventureId" defaultValue="" className={inputClass}>
                  <option value="">None</option>
                  {ventures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton doneLabel="Added">Add lesson</SubmitButton>
            </ActionForm>
          </Reveal>
        </div>
      </Card>

      <nav aria-label="Lesson status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <Link
            key={s.key}
            href={`/playbook?tab=lessons&status=${s.key}`}
            aria-current={status === s.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              status === s.key ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
            }`}
          >
            {s.label} <span className={status === s.key ? "text-dxv-yellow" : "text-black/45"}>{count(s.key)}</span>
          </Link>
        ))}
      </nav>

      {lessons.length === 0 ? (
        <p className="rounded-lg border border-black/10 px-4 py-6 text-center text-sm text-black/55">
          {status === "SUGGESTED" ? "No suggestions waiting." : status === "APPROVED" ? "No lessons yet. Add the first one above." : "Nothing archived."}
        </p>
      ) : (
        <ul className="space-y-3">
          {lessons.map((l) => (
            <li key={l.id} className={`rounded-lg border p-4 ${l.status === "SUGGESTED" ? "border-dxv-yellow bg-dxv-yellow/10" : "border-black/10 bg-white"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <strong className="text-dxv-green">{l.title}</strong>
                    <span className="rounded-full bg-dxv-green/10 px-2 py-px text-[11px] font-medium text-dxv-green">{SCOPE_LABELS[l.scope]}</span>
                    {l.source === "AI" && <span className="rounded bg-dxv-yellow px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-dxv-green">AI suggested</span>}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-black/80">{l.body}</p>
                  <p className="text-xs text-black/45">
                    {l.origin ? `${l.origin} · ` : ""}
                    {l.venture && (
                      <>
                        <Link href={`/deals/${l.venture.id}`} className="text-dxv-green hover:underline">
                          {l.venture.name}
                        </Link>
                        {" · "}
                      </>
                    )}
                    {l.source === "AI" ? "Suggested by the AI" : `Added by ${l.createdBy?.name ?? "DXV"}`} {formatDate(l.createdAt)}
                    {l.approvedBy && l.approvedAt ? ` · approved by ${l.approvedBy.name} ${formatDate(l.approvedAt)}` : ""}
                  </p>
                </div>
                <LessonActions id={l.id} title={l.title} body={l.body} scope={l.scope} status={l.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
