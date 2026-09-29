// "Members' deal room" on the deal page: whether members can see this deal, exactly what
// they see at its current stage, the summary they read, and each document's visibility.
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, formatDateTime, inputClass } from "@/components/ui";
import type { Stage } from "@/generated/prisma/enums";
import { ANGEL_PHASE_LABELS, angelDealPhase, angelSeesDocument, angelSeesMemo, stageLabel } from "@/lib/pipeline";
import { DocVisibilitySelect, ShareToggle } from "./angels-client";
import { setAngelSummary } from "./share-actions";

type Doc = {
  id: string;
  fileName: string;
  category: string;
  angelVisibleFrom: "POST_PITCH" | "COMMITMENTS" | null;
  archivedAt: Date | null;
  uploadedAt: Date | null;
};

export function AngelsCard(props: {
  ventureId: string;
  name: string;
  stage: Stage;
  sharedAt: Date | null;
  summary: string | null;
  docs: Doc[];
  latestIssueName: string | null;
  membersWithAccess: number;
  log: { id: string; action: string; detail: string | null; createdAt: Date; by: { name: string } }[];
}) {
  const { ventureId, stage, sharedAt, docs } = props;
  const phase = angelDealPhase(stage);
  const deck = docs.find((d) => d.category === "DECK");
  const others = docs.filter((d) => d.id !== deck?.id);
  const visibleNow = phase ? others.filter((d) => angelSeesDocument(phase, d)).length : 0;

  return (
    <Card title="Members' deal room" id="deal-room">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            {sharedAt ? (
              <span className="rounded-full bg-dxv-green px-2 py-0.5 text-xs font-medium text-white">Shared {formatDateTime(sharedAt)}</span>
            ) : (
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium">Not shared</span>
            )}
          </p>
          {stage !== "PASSED" && <ShareToggle ventureId={ventureId} shared={!!sharedAt} name={props.name} />}
        </div>

        {/* What members see right now */}
        {stage === "PASSED" ? (
          <p className="text-black/65">Declined deals are never shown to members.</p>
        ) : !sharedAt ? (
          <p className="text-black/65">Members see nothing of this deal. Share it when it reaches Member Pitch Selection (or earlier, ready for then).</p>
        ) : !phase ? (
          <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-2 py-1">
            Shared, but members see nothing at {stageLabel(stage)}. It appears to them from Member Pitch Selection.
          </p>
        ) : (
          <div className="rounded bg-dxv-green/[0.05] p-2">
            <p className="font-medium text-dxv-green">
              {props.membersWithAccess} member{props.membersWithAccess === 1 ? "" : "s"} can see it now ({ANGEL_PHASE_LABELS[phase]}):
            </p>
            <ul className="mt-1 list-disc pl-5 text-black/75">
              <li>{deck ? `Pitch deck: ${deck.fileName}` : <Missing>No pitch deck uploaded yet</Missing>}</li>
              {angelSeesMemo(phase) && <li>{props.latestIssueName ? `Memo: ${props.latestIssueName}` : <Missing>No DXV Review Issue yet</Missing>}</li>}
              {phase !== "pitch-selection" && (
                <li>
                  {visibleNow} other document{visibleNow === 1 ? "" : "s"}
                </li>
              )}
              <li>{phase === "pitch-selection" ? "Their pitch selection vote" : phase === "post-pitch" || stage === "INVESTMENT_COMMITMENTS" ? "Their expression of interest (EOI)" : "No voting at this stage"}</li>
            </ul>
          </div>
        )}
        <p className="text-xs text-black/55">
          Members never see eligibility screens, AI drafts, working drafts, notes, other members&apos; votes, or declined deals. Their votes land in
          Pre-Selection votes and Commitments above.
        </p>

        <div className="border-t border-black/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/55">What members read about the company</p>
          {props.summary ? <p className="mt-1 whitespace-pre-wrap">{props.summary}</p> : <p className="mt-1 text-black/55">No summary: members see the name, sector, stage and raise only.</p>}
          <Reveal label={props.summary ? "Edit summary" : "+ Add summary"}>
            <ActionForm action={setAngelSummary.bind(null, ventureId)} resetOnSuccess={false} className="space-y-2">
              <textarea name="angelSummary" defaultValue={props.summary ?? ""} rows={5} maxLength={4000} className={inputClass} placeholder="A few lines for members: what the company does and why DXV is looking at it." />
              <SubmitButton pendingLabel="Saving…">Save summary</SubmitButton>
            </ActionForm>
          </Reveal>
        </div>

        <div className="border-t border-black/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Documents members see</p>
          <ul className="mt-1 space-y-1.5">
            {deck && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate">{deck.fileName}</span>
                <span className="text-xs text-black/55">Latest deck: from Member Pitch Selection</span>
              </li>
            )}
            {others.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate">{d.fileName}</span>
                <DocVisibilitySelect documentId={d.id} value={d.angelVisibleFrom ?? ""} fileName={d.fileName} />
              </li>
            ))}
            {!deck && others.length === 0 && <li className="text-black/55">No documents yet.</li>}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-3">
          {phase && sharedAt && (
            <Link href={`/deals/${ventureId}/angel-view`} className="font-medium text-dxv-green underline">
              Preview as a member
            </Link>
          )}
          {props.log.length > 0 && (
            <details className="w-full text-xs text-black/60">
              <summary className="cursor-pointer">Sharing history ({props.log.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {props.log.map((l) => (
                  <li key={l.id}>
                    {formatDateTime(l.createdAt)} · {l.by.name} · {l.action}
                    {l.detail && `: ${l.detail}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-dxv-yellow/40 px-1">{children}</span>;
}
