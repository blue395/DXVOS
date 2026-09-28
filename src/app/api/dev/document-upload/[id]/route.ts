// LOCAL DEVELOPMENT ONLY: receives a document upload when Supabase Storage isn't
// configured. In production the browser uploads straight to Supabase instead.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveLocalObject } from "@/lib/deck-storage";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents";

export async function PUT(req: Request, ctx: RouteContext<"/api/dev/document-upload/[id]">) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response("Not found", { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });

  const { id } = await ctx.params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.uploadedAt) return new Response("Unknown upload", { status: 404 });

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return new Response("Bad size", { status: 413 });
  await saveLocalObject(doc.bucket, doc.storagePath, bytes);
  return new Response(null, { status: 204 });
}
