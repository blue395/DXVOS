// Browser side of a deck upload: the PDF goes straight to storage (never through
// Netlify's request size limit), using the target the server action handed out.
import { createClient } from "@supabase/supabase-js";
import type { UploadTarget } from "./deck-storage";

export const MAX_DECK_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Why this file can't be a deck, or null if it's fine. */
export function deckFileProblem(file: File): string | null {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) return "Upload the deck as a PDF.";
  if (file.size > MAX_DECK_UPLOAD_BYTES) return "Decks must be 20 MB or smaller.";
  return null;
}

export async function uploadDeckFile(target: UploadTarget, file: File): Promise<void> {
  return uploadFile(target, file, "application/pdf");
}

export async function uploadFile(target: UploadTarget, file: File, contentType: string): Promise<void> {
  if (target.kind === "supabase") {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { error } = await sb.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { contentType });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  } else {
    const res = await fetch(target.url, { method: "PUT", body: file });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  }
}
