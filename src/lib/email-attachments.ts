// Attachments on emails to angels: what can be attached, and the limits. Pure.

/** Their own private storage bucket (created by migration 20261102090000). */
export const EMAIL_ATTACHMENTS_BUCKET = "email-attachments";

/** PDF, Word, Excel and images. Extension to MIME type. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((e) => `.${e}`)
  .join(",");

/** All of an email's attachments together: Gmail's limit is 25 MB once encoded, so 15 MB of files. */
export const MAX_ATTACHMENTS_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

/** The MIME type for a file, or why it can't be attached. */
export function checkAttachment(fileName: string, sizeBytes: number, alreadyBytes = 0): { mimeType: string } | { error: string } {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const mimeType = ATTACHMENT_TYPES[ext];
  if (!mimeType) return { error: "Attach a PDF, Word, Excel, PNG or JPEG file." };
  if (sizeBytes <= 0) return { error: "That file is empty." };
  if (alreadyBytes + sizeBytes > MAX_ATTACHMENTS_BYTES) return { error: "Attachments can be 15 MB in total (email providers refuse bigger emails)." };
  return { mimeType };
}

/** Who an email carrying deal material may go to: only members who can see deals (a current investor statement). */
export function attachmentRecipients<T extends { id: string }>(
  people: T[],
  carriesDealMaterial: boolean,
  dealAccess: Set<string>,
): { send: T[]; leftOut: T[] } {
  if (!carriesDealMaterial) return { send: people, leftOut: [] };
  return { send: people.filter((p) => dealAccess.has(p.id)), leftOut: people.filter((p) => !dealAccess.has(p.id)) };
}
