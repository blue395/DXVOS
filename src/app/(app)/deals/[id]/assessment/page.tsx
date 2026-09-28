import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { aiDraftName, issueNumbers, renderMemo, reviewDraftName, reviewIssueName } from "@/lib/memo-ai/render";
import { totalScore, MAX_TOTAL_SCORE, type MemoContent } from "@/lib/memo-ai/schema";
import { canGenerateAssessment } from "@/lib/pipeline";
import { AiTag, Card, formatDateTime, StageBadge } from "@/components/ui";
import { CopyButton } from "../eligibility-client";
import { FinaliseForm, GenerateButton, MemoTextForm, ReviseIssueButton, ScoreRow, StartReviewButton } from "./assessment-client";
import { MemoView, ReviewBanner, TotalScore } from "./memo-view";

// View is chosen by ?view=: "review" (the open DXV Review Draft), "ai-<n>" (AI Draft n)
// or "v-<n>" (memo version n, shown as DXV Review Issue <k>).
export default async function AssessmentPage({ params, searchParams }: PageProps<"/deals/[id]/assessment">) {
  await requireAdmin();
  const { id } = await params;
  const view = String((await searchParams).view ?? "");

  const v = await db.venture.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      currentStage: true,
      memoAnalyses: { orderBy: { number: "desc" }, include: { createdBy: { select: { name: true } } } },
      memoDrafts: {
        where: { archivedAt: null },
        take: 1,
        include: {
          analysis: { select: { number: true, output: true } },
          updatedBy: { select: { name: true } },
          scoreChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } },
        },
      },
      memoVersions: { where: { kind: "REVIEWED_MEMO" }, orderBy: { version: "desc" }, include: { createdBy: { select: { name: true } } } },
      deckAnalyses: { where: { status: { not: "PENDING" } }, take: 1, select: { id: true } },
    },
  });
  if (!v) notFound();

  const draft = v.memoDrafts[0] ?? null;
  const issueNo = issueNumbers(v.memoVersions);
  const nextIssue = v.memoVersions.length + 1;
  const analyses = v.memoAnalyses.map((a) => ({ ...a, effective: effectiveDeckStatus(a) }));
  const running = analyses.some((a) => a.effective.status === "PENDING" || a.effective.status === "PROCESSING");
  const latestComplete = analyses.find((a) => a.status === "COMPLETE");
  const canGenerate = canGenerateAssessment(v.currentStage);
  const hasDeck = v.deckAnalyses.length > 0;

  // Default view: the open review copy, else the latest complete AI draft.
  const selected =
    view === "review" && draft
      ? { kind: "review" as const }
      : view.startsWith("ai-") && analyses.some((a) => a.number === Number(view.slice(3)))
        ? { kind: "ai" as const, number: Number(view.slice(3)) }
        : view.startsWith("v-") && v.memoVersions.some((m) => m.version === Number(view.slice(2)))
          ? { kind: "version" as const, version: Number(view.slice(2)) }
          : draft
            ? { kind: "review" as const }
            : v.memoVersions[0]
              ? { kind: "version" as const, version: v.memoVersions[0].version }
              : latestComplete
              ? { kind: "ai" as const, number: latestComplete.number }
              : null;

  const base = `/deals/${v.id}/assessment`;
  const tabs = [
    // Newest first: AI drafts, then the open review draft, then issues, following the flow.
    ...v.memoVersions.map((m) => ({
      href: `${base}?view=v-${m.version}`,
      label: reviewIssueName(issueNo.get(m.id)!),
      active: selected?.kind === "version" && selected.version === m.version,
    })),
    ...(draft ? [{ href: `${base}?view=review`, label: `${reviewDraftName(draft.number)} (in progress)`, active: selected?.kind === "review" }] : []),
    ...analyses.map((a) => ({
      href: `${base}?view=ai-${a.number}`,
      label: `${aiDraftName(a.number)}${a.effective.status === "COMPLETE" ? "" : a.effective.status === "FAILED" ? " (failed)" : " (drafting…)"}`,
      active: selected?.kind === "ai" && selected.number === a.number,
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href={`/deals/${v.id}`} className="text-sm text-dxv-green hover:underline">
          ← {v.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-dxv-green">Investment assessment</h1>
          <StageBadge stage={v.currentStage} />
        </div>
        <p className="text-sm text-black/60">
          AI Draft, then a DXV Review Draft you edit and save, then Mark complete to release a locked DXV Review Issue for the syndicate.
        </p>
      </div>

      {/* Generate */}
      <div className="flex flex-wrap items-center gap-3">
        {canGenerate && hasDeck && !running && <GenerateButton ventureId={v.id} again={analyses.length > 0} />}
        {!canGenerate && <p className="text-sm text-black/55">The AI assessment is available from DXV Partner Review onwards.</p>}
        {canGenerate && !hasDeck && (
          <p className="text-sm text-black/55">
            No deck is stored for this venture. Upload one on the deal page&apos;s Eligibility screen card first.
          </p>
        )}
        {running && (
          <p className="flex items-center gap-2 text-sm text-dxv-green" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
            Drafting the assessment… usually 1 to 3 minutes. Progress is in the corner; this page updates when it&apos;s done.
          </p>
        )}
      </div>

      {tabs.length > 0 && (
        <nav aria-label="Memo versions" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                t.active ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {!selected && !running && (
        <Card>
          <p className="text-sm text-black/60">No assessment yet. Generate one to get a first-draft memo in DXV&apos;s template.</p>
        </Card>
      )}

      {/* AI draft (read-only) */}
      {selected?.kind === "ai" &&
        (() => {
          const a = analyses.find((x) => x.number === selected.number)!;
          if (a.effective.status === "FAILED") {
            return (
              <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
                {aiDraftName(a.number)} failed: {a.effective.error}
              </p>
            );
          }
          if (a.effective.status !== "COMPLETE" || !a.output) return null;
          const m = a.output as MemoContent;
          return (
            <Card
              title={aiDraftName(a.number)}
              actions={<StartReviewButton analysisId={a.id} aiNumber={a.number} draftNumber={draft?.number ?? nextIssue} replacing={!!draft} />}
            >
              <div className="space-y-5">
                <ReviewBanner />
                <MemoView m={m} />
                <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 text-xs text-black/50">
                  <CopyButton text={renderMemo(m, { banner: true })} label="Copy as text" />
                  <AiTag>AI Draft</AiTag>
                  <span>
                    {a.model} · run by {a.createdBy.name} · {formatDateTime(a.completedAt ?? a.createdAt)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })()}

      {/* Review copy (editable) */}
      {selected?.kind === "review" && draft && (() => {
        const m = draft.content as MemoContent;
        const aiScores = (draft.analysis.output as MemoContent | null)?.scores ?? [];
        const version = draft.updatedAt.toISOString();
        return (
          <div className="space-y-5">
            <ReviewBanner />
            <p className="text-sm text-black/60">
              <strong>{reviewDraftName(draft.number)}</strong>, from {aiDraftName(draft.analysis.number)}
              {draft.number > 1 ? ` via ${reviewIssueName(draft.number - 1)}` : ""}
              {draft.updatedBy ? `. Last saved by ${draft.updatedBy.name} ${formatDateTime(draft.updatedAt)}` : ""}. Save as you go; it
              stays {reviewDraftName(draft.number)} until you mark it complete.
            </p>

            <Card title="Memo text">
              <MemoTextForm draftId={draft.id} m={m} version={version} />
            </Card>

            <Card title="Scoring" actions={<TotalScore scores={m.scores} />}>
              <p className="mb-3 text-xs text-black/55">
                Overrule any single score here without re-running the assessment. The AI&apos;s original score is shown for
                each; changed rows are highlighted and every change is logged.
              </p>
              <ul className="space-y-2">
                {m.scores.map((s) => (
                  <ScoreRow key={s.criterion} draftId={draft.id} s={s} ai={aiScores.find((a) => a.criterion === s.criterion)} version={version} />
                ))}
              </ul>
              {draft.scoreChanges.length > 0 && (
                <div className="mt-4 border-t border-black/10 pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/55">Score changes</h3>
                  <ul className="space-y-1 text-sm">
                    {draft.scoreChanges.map((c) => (
                      <li key={c.id}>
                        <strong>{c.criterion}</strong>: {c.fromScore} to {c.toScore}
                        {c.reason && <span className="text-black/65"> · “{c.reason}”</span>}
                        <span className="text-xs text-black/45">
                          {" "}
                          · {c.changedBy.name}, {formatDateTime(c.changedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="Mark complete">
              <p className="mb-3 text-sm text-black/60">
                Releases {reviewDraftName(draft.number)} as <strong>{reviewIssueName(draft.number)}</strong> (
                {totalScore(m.scores)}/{MAX_TOTAL_SCORE}): locked, for sharing with the syndicate before the Pre-Selection vote.
                To change it later, revise it into {reviewDraftName(draft.number + 1)} and issue again.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <FinaliseForm draftId={draft.id} issueName={reviewIssueName(draft.number)} />
                <CopyButton text={renderMemo(m, { banner: true })} label="Copy as text" />
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Reviewed version (locked) */}
      {selected?.kind === "version" &&
        (() => {
          const mv = v.memoVersions.find((x) => x.version === selected.version)!;
          const m = mv.content as MemoContent;
          const name = reviewIssueName(issueNo.get(mv.id)!);
          const isLatestIssue = mv.version === v.memoVersions[0]?.version;
          const footer = `${name}, issued by ${mv.createdBy.name} on ${formatDateTime(mv.createdAt)}.`;
          return (
            <Card
              title={name}
              actions={
                <span className="flex flex-wrap items-center gap-2">
                  {isLatestIssue && !draft && <ReviseIssueButton memoVersionId={mv.id} draftName={reviewDraftName(nextIssue)} />}
                  <CopyButton text={renderMemo(m, { banner: false, footer })} label="Copy as text" />
                </span>
              }
            >
              <div className="space-y-5">
                <p className="rounded-md bg-dxv-green px-4 py-2 text-sm text-white">
                  {footer}
                  {mv.summary ? ` ${mv.summary}` : ""}
                </p>
                <MemoView m={m} />
              </div>
            </Card>
          );
        })()}
    </div>
  );
}
