// LOCAL DEVELOPMENT ONLY: receives an email attachment upload when Supabase Storage isn't
// configured. In production the browser uploads straight to Supabase instead.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveLocalObject } from "@/lib/deck-storage";
import { MAX_ATTACHMENTS_BYTES } from "@/lib/email-attachments";

export async function PUT(req: Request, ctx: RouteContext<"/api/dev/email-attachment-upload/[id]">) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response("Not found", { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const a = await db.memberEmailAttachment.findFirst({ where: { id, createdById: user.id, uploadedAt: null } });
  if (!a) return new Response("Unknown upload", { status: 404 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENTS_BYTES) return new Response("Bad size", { status: 413 });
  await saveLocalObject(a.bucket, a.storagePath, bytes);
  return new Response(null, { status: 204 });
}
