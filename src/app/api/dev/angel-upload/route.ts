// LOCAL DEVELOPMENT ONLY: receives an angel's signed statement when Supabase Storage
// isn't configured. In production the browser uploads straight to Supabase instead.
import { getCurrentUser } from "@/lib/auth";
import { saveLocalObject } from "@/lib/deck-storage";
import { DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES } from "@/lib/documents";

export async function PUT(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response("Not found", { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!/^angels\/[\w-]+\/[\w-]+\/[^/]+$/.test(path) || path.includes("..")) return new Response("Bad path", { status: 400 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return new Response("Bad size", { status: 413 });
  await saveLocalObject(DOCUMENTS_BUCKET, path, bytes);
  return new Response(null, { status: 204 });
}
