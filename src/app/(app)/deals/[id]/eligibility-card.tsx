import type { EligibilityDecision, PassReason, Stage } from "@/generated/prisma/enums";
import type { EligibilityScreen } from "@/lib/deck-ai/schema";
import { renderScreen } from "@/lib/deck-ai/render";
import { effectiveDeckStatus, type DeckStatus } from "@/lib/deck-status";
import { canDecideEligibility, PASS_REASON_LABELS } from "@/lib/pipeline";
import { AiTag, Card, formatDateTime } from "@/components/ui";
import { decideEligibility } from "../deck-actions";
import { CopyButton, DecisionForm, DeckUploadForVenture, RerunButton } from "./eligibility-client";

type Analysis = {
  id: string;
  status: DeckStatus;
  error: string | null;
  fileName: string;
  model: string | null;
  screen: unknown;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: { name: string };
};

type Review = {
  id: string;
  decision: EligibilityDecision;
  passReason: PassReason | null;
  note: string | null;
  decidedAt: Date;
  decidedBy: { name: string };
};

const DECISION_TEXT: Record<EligibilityDecision, string> = {
  PROCEED: "Proceed to pipeline",
  DECLINE: "Decline",
  NEED_MORE_INFO: "Request more information",
};

/**
 * The AI's eligibility screen next to the human decision. The screen is a first
 * pass only: nothing moves until a person records a decision.
 */
export function EligibilityCard({
  ventureId,
  stage,
  analyses,
  reviews,
}: {
  ventureId: string;
  stage: Stage;
  analyses: Analysis[]; // newest first
  reviews: Review[]; // newest first
}) {
  const latest = analyses[0];
  const effective = latest ? effectiveDeckStatus(latest) : null;
  const lastComplete = analyses.find((a) => a.status === "COMPLETE");
  const screen = (lastComplete?.screen ?? null) as EligibilityScreen | null;
  const hasStoredDeck = analyses.some((a) => a.status !== "PENDING");
  const running = effective && (effective.status === "PENDING" || effective.status === "PROCESSING");
  const decidable = canDecideEligibility(stage);

  return (
    <Card
      title="Eligibility screen"
      actions={latest ? <a href={`/api/decks/${latest.id}`} className="text-xs text-dxv-green hover:underline">Download stored deck</a> : undefined}
    >
      <div className="space-y-4">
        {!latest && (
          <>
            <p className="text-sm text-black/60">
              No deck has been screened yet. Upload the deck to get an AI first-pass eligibility screen.
            </p>
            <DeckUploadForVenture ventureId={ventureId} />
          </>
        )}

        {running && (
          <p className="flex items-center gap-2 text-sm text-dxv-green" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
            Reading {latest.fileName}… progress is in the corner; this page updates when it&apos;s done.
          </p>
        )}

        {effective?.status === "FAILED" && (
          <div className="space-y-2">
            <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
              The latest screen failed: {effective.error}
            </p>
            <div className="flex flex-wrap gap-2">{hasStoredDeck && <RerunButton ventureId={ventureId} />}</div>
            <DeckUploadForVenture ventureId={ventureId} label="Or upload a deck (PDF)" />
          </div>
        )}

        {screen && lastComplete && <ScreenView screen={screen} analysis={lastComplete} isLatest={lastComplete === latest} ventureId={ventureId} />}

        {/* ── Human decision ── */}
        {decidable ? (
          <div className="border-t border-black/10 pt-4">
            <DecisionForm
              action={decideEligibility.bind(null, ventureId)}
              analysisId={lastComplete?.id ?? null}
              suggestedRequest={screen?.nextStep.startsWith("Request from founder") ? screen.nextStep.replace(/^Request from founder:\s*/, "") : undefined}
            />
          </div>
        ) : (
          <p className="border-t border-black/10 pt-3 text-xs text-black/55">
            This deal is past eligibility screening, so decisions here are closed. Use the Stage card to move it.
          </p>
        )}

        {reviews.length > 0 && (
          <div className="border-t border-black/10 pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/55">Decisions</h3>
            <ul className="space-y-2 text-sm">
              {reviews.map((r) => (
                <li key={r.id}>
                  <strong>{DECISION_TEXT[r.decision]}</strong>
                  {r.passReason && <span className="text-black/65"> ({PASS_REASON_LABELS[r.passReason]})</span>}
                  {r.note && <span className="text-black/65"> · “{r.note}”</span>}
                  <span className="block text-xs text-black/45">
                    {r.decidedBy.name} · {formatDateTime(r.decidedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function ScreenView({
  screen,
  analysis,
  isLatest,
  ventureId,
}: {
  screen: EligibilityScreen;
  analysis: Analysis;
  isLatest: boolean;
  ventureId: string;
}) {
  const rec = screen.recommendation;
  const recClass =
    rec === "Proceed to pipeline" ? "bg-dxv-green text-white" : rec === "Decline" ? "bg-black text-white" : "bg-dxv-yellow text-dxv-green";

  return (
    <div className="space-y-3">
      {/* Material issues first (house style: flag prominently and upfront). */}
      {screen.redFlags.length > 0 && (
        <div className="rounded-md border-2 border-dxv-yellow bg-dxv-yellow/15 p-3">
          <p className="text-sm font-semibold text-dxv-green">Red flags</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {screen.redFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {screen.thesisFit.rating === "Not stated" && (
        <p className="rounded-md border-2 border-dxv-yellow bg-dxv-yellow/15 p-3 text-sm">
          <strong>Thesis fit not stated.</strong> Check directly with the founder. This is information DXV needs to ask for,
          not assume, so don&apos;t decline on this alone.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AiTag>AI first pass, not a decision</AiTag>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${recClass}`}>AI recommends: {rec}</span>
        {!isLatest && <span className="text-xs text-black/55">(from an earlier run; the latest run didn&apos;t complete)</span>}
      </div>

      <p className="text-sm">{screen.oneLineSummary}</p>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
        <Row label="Stage fit" value={`${screen.stageFit.rating} - ${screen.stageFit.reasoning}`} />
        <Row label="Sector" value={`${screen.sector.name} - ${screen.sector.note}`} />
        <Row label="Team strength" value={screen.teamStrength} />
        <Row label="DXV thesis fit" value={`${screen.thesisFit.rating} - ${screen.thesisFit.reasoning}`} />
        <Row label="Red flags" value={screen.redFlags.length ? screen.redFlags.join("; ") : "None identified"} />
        <Row label="Next step" value={screen.nextStep} />
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-xs text-black/50">
        <CopyButton text={renderScreen(screen)} />
        <RerunButton ventureId={ventureId} />
        <span>
          {analysis.fileName} · {analysis.model} · run by {analysis.createdBy.name} ·{" "}
          {formatDateTime(analysis.completedAt ?? analysis.createdAt)}
        </span>
      </div>
      <p className="text-xs text-black/45">
        Suggestions only: read the deck before deciding.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-black/60">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
