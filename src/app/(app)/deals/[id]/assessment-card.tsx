import Link from "next/link";
import { effectiveDeckStatus, type DeckStatus } from "@/lib/deck-status";
import { maxScore, totalScore, type MemoContent } from "@/lib/memo-ai/schema";
import { aiDraftName, reviewDraftName, reviewIssueName } from "@/lib/memo-ai/render";
import { AiTag, buttonClass, Card, formatDateTime } from "@/components/ui";
import { GenerateButton } from "./assessment/assessment-client";

/** Compact summary on the deal page; the full memo lives at /deals/[id]/assessment. */
export function AssessmentCard({
  ventureId,
  canGenerate,
  hasDeck,
  latest,
  draft,
  reviewed,
  collapse,
  memoSummary,
  children,
}: {
  ventureId: string;
  canGenerate: boolean;
  hasDeck: boolean;
  latest: { number: number; status: DeckStatus; error: string | null; output: unknown; createdAt: Date; startedAt: Date | null; completedAt: Date | null } | null;
  draft: { number: number; content: unknown; updatedAt: Date } | null;
  reviewed: { issueNumber: number; content: unknown; createdAt: Date; createdBy: { name: string } } | null;
  collapse?: { open: boolean; now: boolean };
  /** Collapsed summary when there's an uploaded memo but no AI work yet. */
  memoSummary?: string | null;
  /** The memo versions list (issues and uploaded files), shown under the assessment. */
  children?: React.ReactNode;
}) {
  const eff = latest ? effectiveDeckStatus(latest) : null;
  const running = eff && (eff.status === "PENDING" || eff.status === "PROCESSING");
  const scoreOf = (c: unknown) => totalScore((c as MemoContent).scores);
  const maxOf = (c: unknown) => maxScore((c as MemoContent).scores);
  const href = `/deals/${ventureId}/assessment`;

  return (
    <Card
      title="Investment assessment & memo"
      id="assessment"
      collapse={
        collapse && {
          ...collapse,
          summary: reviewed
            ? `${reviewIssueName(reviewed.issueNumber)} · ${scoreOf(reviewed.content)}/${maxOf(reviewed.content)}`
            : draft
              ? `${reviewDraftName(draft.number)} in progress`
              : latest && eff?.status === "COMPLETE"
                ? `${aiDraftName(latest.number)} · ${scoreOf(latest.output)}/${maxOf(latest.output)}`
                : running
                  ? "Drafting…"
                  : (memoSummary ?? "Not started"),
        }
      }
      actions={latest ? <Link href={href} className="text-xs text-dxv-green hover:underline">Open assessment →</Link> : undefined}>
      <div className="space-y-3 text-sm">
        {!latest && (
          <p className="text-black/60">
            {canGenerate
              ? "Get an AI-assisted first-draft memo in DXV's template, scored against the eleven criteria. Once a DXV team member reviews and marks it complete, it becomes the memo (DXV Review Issue)."
              : "The AI assessment is available from DXV Partner Review onwards. Reviewed and completed, it becomes the investment memo."}
          </p>
        )}

        {running && (
          <p className="flex items-center gap-2 text-dxv-green" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
            Drafting {aiDraftName(latest!.number)}… usually 1 to 3 minutes.
          </p>
        )}
        {eff?.status === "FAILED" && (
          <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2">
            {aiDraftName(latest!.number)} failed: {eff.error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {latest?.status === "COMPLETE" && !!latest.output && (
            <Summary label={aiDraftName(latest.number)} score={scoreOf(latest.output)} max={maxOf(latest.output)} tag={<AiTag>AI</AiTag>} when={latest.completedAt ?? latest.createdAt} />
          )}
          {draft && <Summary label={`${reviewDraftName(draft.number)} (in progress)`} score={scoreOf(draft.content)} max={maxOf(draft.content)} when={draft.updatedAt} />}
          {reviewed && <Summary label={reviewIssueName(reviewed.issueNumber)} score={scoreOf(reviewed.content)} max={maxOf(reviewed.content)} when={reviewed.createdAt} by={reviewed.createdBy.name} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && hasDeck && !running && <GenerateButton ventureId={ventureId} again={!!latest} />}
          {canGenerate && !hasDeck && <span className="text-black/55">Upload a deck on the Eligibility screen card first.</span>}
          {latest && (
            <Link href={href} className={buttonClass("secondary")}>
              Open assessment
            </Link>
          )}
        </div>

        {children && (
          <div className="border-t border-black/10 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/55">Memo versions</h3>
            {children}
          </div>
        )}
      </div>
    </Card>
  );
}

function Summary({ label, score, max, when, by, tag }: { label: string; score: number; max: number; when: Date; by?: string; tag?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-black/55">
        {label} {tag}
      </p>
      <p className="text-xl font-semibold text-dxv-green tabular-nums">
        {score}
        <span className="text-sm text-black/40">/{max}</span>
      </p>
      <p className="text-[11px] text-black/45">
        {by ? `${by} · ` : ""}
        {formatDateTime(when)}
      </p>
    </div>
  );
}
