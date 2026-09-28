// "Create DD document" on the Due Diligence card: status of the latest job and a link to the Word file.
import type { Stage } from "@/generated/prisma/enums";
import { effectiveDeckStatus, type DeckStatus } from "@/lib/deck-status";
import { canCreateDDDocument } from "@/lib/pipeline";
import { AiTag, formatDateTime } from "@/components/ui";
import { AutoRefresh } from "./eligibility-client";
import { CreateDDDocumentButton } from "./dd-document-client";

export type DDJobRow = {
  status: DeckStatus;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: { name: string };
  document: { id: string; fileName: string; archivedAt: Date | null } | null;
};

export function DDDocumentPanel({ ventureId, stage, latest }: { ventureId: string; stage: Stage; latest: DDJobRow | null }) {
  const status = latest ? effectiveDeckStatus(latest) : null;
  const running = status?.status === "PENDING" || status?.status === "PROCESSING";
  const allowed = canCreateDDDocument(stage);
  if (!allowed && !latest) return null;

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-dxv-green/15 bg-dxv-green/[0.03] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {allowed && !running && <CreateDDDocumentButton ventureId={ventureId} again={!!latest} />}
        <span className="text-xs text-black/55">
          A DXV-branded Word document: DD plan by area, questions, evidence to request and a findings template. AI first draft; the DD group
          completes it.
        </span>
      </div>
      {running && (
        <p className="flex items-center gap-2 text-dxv-green" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
          Drafting the DD document… usually 1 to 3 minutes. This page updates by itself.
          <AutoRefresh />
        </p>
      )}
      {status?.status === "FAILED" && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2">
          The DD document couldn&apos;t be drafted: {status.error}
        </p>
      )}
      {status?.status === "COMPLETE" && latest?.document && (
        <p className="flex flex-wrap items-center gap-2">
          <AiTag>AI first draft</AiTag>
          <a href={`/api/documents/${latest.document.id}?download=1`} className="font-medium text-dxv-green hover:underline">
            {latest.document.fileName}
          </a>
          <span className="text-xs text-black/50">
            {latest.createdBy.name}, {formatDateTime(latest.completedAt ?? latest.createdAt)}
            {latest.document.archivedAt ? " · archived" : " · also under Documents"}
          </span>
        </p>
      )}
    </div>
  );
}
