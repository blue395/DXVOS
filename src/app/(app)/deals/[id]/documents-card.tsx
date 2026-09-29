import type { DocumentCategory } from "@/generated/prisma/enums";
import { CATEGORIES, CATEGORY_LABELS, fileKind, formatFileSize } from "@/lib/documents";
import { Card, formatDate } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import { ArchiveDocumentButton } from "./documents-client";

export type DocRow = {
  id: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  uploadedAt: Date | null;
  uploadedBy: { name: string };
  ddItemId: string | null;
  ddItem: { title: string } | null;
  isMemoVersion: boolean;
  /** Set for DD reports DXV OS generated: offers a PDF export alongside the Word file. */
  ddReportJobId?: string | null;
};

/** Every document on the deal, grouped by category. DXV OS is the document store. */
export function DocumentsCard({ ventureId, docs, collapse }: { ventureId: string; docs: DocRow[]; collapse?: { open: boolean; now: boolean } }) {
  const groups = CATEGORIES.map((c) => ({ category: c, docs: docs.filter((d) => d.category === c) })).filter((g) => g.docs.length);
  return (
    <Card
      title="Documents"
      id="documents"
      collapse={collapse && { ...collapse, now: false, summary: `${docs.length} file${docs.length === 1 ? "" : "s"}` }}
      actions={<span className="text-xs text-black/55">{docs.length} file{docs.length === 1 ? "" : "s"}</span>}>
      <div className="space-y-4">
        {groups.length === 0 && <p className="text-sm text-black/55">No documents yet. Decks, memos, DD papers and legal documents all live here.</p>}
        {groups.map((g) => (
          <div key={g.category}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/55">{CATEGORY_LABELS[g.category]}</h3>
            <ul className="divide-y divide-black/10">
              {g.docs.map((d) => (
                <DocumentItem key={d.id} d={d} />
              ))}
            </ul>
          </div>
        ))}
        <DocumentUploader ventureId={ventureId} />
      </div>
    </Card>
  );
}

export function DocumentItem({ d, showArchive = true }: { d: DocRow; showArchive?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="rounded bg-dxv-green/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-dxv-green">{fileKind(d.mimeType)}</span>
      <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-dxv-green hover:underline">
        {d.fileName}
      </a>
      <span className="text-xs text-black/50">
        {formatFileSize(d.sizeBytes)} · {d.uploadedBy.name} · {formatDate(d.uploadedAt)}
        {d.ddItem ? ` · DD: ${d.ddItem.title}` : ""}
      </span>
      <a href={`/api/documents/${d.id}?download=1`} className="text-xs text-dxv-green hover:underline">
        Download
      </a>
      {d.ddReportJobId && (
        <a href={`/api/export/dd/${d.ddReportJobId}?format=pdf`} download className="text-xs text-dxv-green hover:underline" title="Download this DD report as a PDF">
          PDF
        </a>
      )}
      {showArchive && !d.isMemoVersion && <ArchiveDocumentButton documentId={d.id} fileName={d.fileName} />}
      {d.note && <p className="w-full text-xs text-black/55">{d.note}</p>}
    </li>
  );
}
