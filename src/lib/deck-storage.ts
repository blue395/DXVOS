// Where uploaded files live (decks and deal documents).
//  - Production: private Supabase Storage buckets ("decks" for AI-screened decks,
//    "documents" for everything else). The browser uploads straight to Supabase
//    with a one-time signed URL (so large files never pass through Netlify's ~4.5 MB
//    request limit); the server reads with the secret key.
//  - Local development (no Supabase configured): files under .data/<bucket>/.
//
// Used by both the Next.js server and the Netlify background worker, so no
// Next-only imports here. Never import this from client components: it reads secrets.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DECK_BUCKET = "decks";
export const MAX_DECK_BYTES = 20 * 1024 * 1024; // matches the bucket's limit (see migration)

export type UploadTarget =
  | { kind: "supabase"; bucket: string; path: string; token: string }
  | { kind: "local"; url: string };

function localFile(bucket: string, storagePath: string) {
  return path.join(process.cwd(), ".data", bucket, storagePath);
}

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function assertLocalAllowed() {
  if (process.env.NODE_ENV === "production" && !process.env.DECK_STORAGE_LOCAL) {
    throw new Error("File storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
}

/** Safe object path: <id>/<sanitised file name>. Keeps the extension if it's allowed. */
export function objectPath(id: string, fileName: string, defaultExt = "pdf", fallbackName = "file"): string {
  const base = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || `${fallbackName}.${defaultExt}`;
  return `${id}/${/\.[A-Za-z0-9]+$/.test(base) ? base : `${base}.${defaultExt}`}`;
}

/** Deck paths are always .pdf (the AI reads PDFs). */
export function deckPath(analysisId: string, fileName: string): string {
  const p = objectPath(analysisId, fileName, "pdf", "deck");
  return p.toLowerCase().endsWith(".pdf") ? p : `${p}.pdf`;
}

/** Where the browser should upload. `localUrl` is the dev-only upload route. */
export async function createUploadTargetIn(bucket: string, storagePath: string, localUrl: string): Promise<UploadTarget> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(storagePath);
    if (error || !data) throw new Error(`Couldn't prepare the upload: ${error?.message ?? "unknown error"}`);
    return { kind: "supabase", bucket, path: data.path, token: data.token };
  }
  assertLocalAllowed();
  return { kind: "local", url: localUrl };
}

export async function saveLocalObject(bucket: string, storagePath: string, bytes: Buffer): Promise<void> {
  assertLocalAllowed();
  const file = localFile(bucket, storagePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function readObject(bucket: string, storagePath: string): Promise<Buffer> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.storage.from(bucket).download(storagePath);
    if (error || !data) throw new Error(`Couldn't read the file from storage: ${error?.message ?? "not found"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  assertLocalAllowed();
  return readFile(localFile(bucket, storagePath));
}

/** Does the object exist? (Used to confirm a browser upload really finished.) */
export async function objectExists(bucket: string, storagePath: string): Promise<boolean> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.storage.from(bucket).exists(storagePath);
    return !!data;
  }
  try {
    await readFile(localFile(bucket, storagePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Short-lived (60s) link to open or download a stored file; null in local mode.
 * `download: false` lets the browser show PDFs inline.
 */
export async function signedObjectUrl(bucket: string, storagePath: string, fileName: string, download = true): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(storagePath, 60, download ? { download: fileName } : undefined);
  if (error || !data) throw new Error(`Couldn't create a link: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

// ── Deck wrappers (AI eligibility screen) ───────────────────────────────────

export const createUploadTarget = (storagePath: string, analysisId: string) =>
  createUploadTargetIn(DECK_BUCKET, storagePath, `/api/dev/deck-upload/${analysisId}`);
export const saveLocalDeck = (storagePath: string, bytes: Buffer) => saveLocalObject(DECK_BUCKET, storagePath, bytes);
export const readDeck = (storagePath: string) => readObject(DECK_BUCKET, storagePath);
export const signedDownloadUrl = (storagePath: string, fileName: string) => signedObjectUrl(DECK_BUCKET, storagePath, fileName);

/** Server-side upload (used by background workers to store generated files). */
export async function uploadObject(bucket: string, storagePath: string, bytes: Buffer, contentType: string): Promise<void> {
  const sb = supabase();
  if (sb) {
    const { error } = await sb.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Couldn't store the file: ${error.message}`);
    return;
  }
  await saveLocalObject(bucket, storagePath, bytes);
}
