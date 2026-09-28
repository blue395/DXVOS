// Where uploaded decks live.
//  - Production: a private Supabase Storage bucket ("decks"). The browser uploads
//    straight to Supabase with a one-time signed URL (so large PDFs never pass
//    through Netlify's ~4.5 MB request limit); the server reads with the secret key.
//  - Local development (no Supabase configured): files under .data/decks/.
//
// Used by both the Next.js server and the Netlify background worker, so no
// Next-only imports here. Never import this from client components: it reads secrets.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DECK_BUCKET = "decks";
export const MAX_DECK_BYTES = 20 * 1024 * 1024; // matches the bucket's limit (see migration)

export type UploadTarget =
  | { kind: "supabase"; path: string; token: string }
  | { kind: "local"; url: string };

const LOCAL_DIR = path.join(process.cwd(), ".data", "decks");

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function assertLocalAllowed() {
  if (process.env.NODE_ENV === "production" && !process.env.DECK_STORAGE_LOCAL) {
    throw new Error("Deck storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
}

/** Safe object path: <analysisId>/<sanitised file name>. */
export function deckPath(analysisId: string, fileName: string): string {
  const base = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "deck.pdf";
  return `${analysisId}/${base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`}`;
}

export async function createUploadTarget(storagePath: string, analysisId: string): Promise<UploadTarget> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.storage.from(DECK_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data) throw new Error(`Couldn't prepare the upload: ${error?.message ?? "unknown error"}`);
    return { kind: "supabase", path: data.path, token: data.token };
  }
  assertLocalAllowed();
  return { kind: "local", url: `/api/dev/deck-upload/${analysisId}` };
}

export async function saveLocalDeck(storagePath: string, bytes: Buffer): Promise<void> {
  assertLocalAllowed();
  const file = path.join(LOCAL_DIR, storagePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function readDeck(storagePath: string): Promise<Buffer> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.storage.from(DECK_BUCKET).download(storagePath);
    if (error || !data) throw new Error(`Couldn't read the deck from storage: ${error?.message ?? "not found"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  assertLocalAllowed();
  return readFile(path.join(LOCAL_DIR, storagePath));
}

/** Short-lived link for an admin to download the stored copy; null in local mode. */
export async function signedDownloadUrl(storagePath: string, fileName: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(DECK_BUCKET).createSignedUrl(storagePath, 60, { download: fileName });
  if (error || !data) throw new Error(`Couldn't create a download link: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}
