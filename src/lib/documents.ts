// Document rules: what can be uploaded, and how categories are labelled. Pure.
import type { DocumentCategory } from "@/generated/prisma/enums";

export const DOCUMENTS_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // matches the bucket limit (and Supabase's free-plan cap)

/** PDF, Word and Excel (Blue's choice). Extension to MIME type. */
export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES)
  .map((e) => `.${e}`)
  .join(",");

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  DECK: "Deck",
  MEMO: "Memo",
  DUE_DILIGENCE: "Due diligence",
  LEGAL: "Legal",
  FINANCIALS: "Financials",
  OTHER: "Other",
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as DocumentCategory[];

/** The MIME type to store for a file name, or an error message if it isn't allowed. */
export function checkUpload(fileName: string, sizeBytes: number): { mimeType: string } | { error: string } {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const mimeType = ALLOWED_TYPES[ext];
  if (!mimeType) return { error: "Upload a PDF, Word (.doc, .docx) or Excel (.xls, .xlsx) file." };
  if (sizeBytes <= 0) return { error: "That file is empty." };
  if (sizeBytes > MAX_DOCUMENT_BYTES) return { error: "Files must be 50 MB or smaller." };
  return { mimeType };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short label for the file type badge. */
export function fileKind(mimeType: string): "PDF" | "Word" | "Excel" | "File" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Excel";
  return "File";
}
