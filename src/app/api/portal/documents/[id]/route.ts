// Open a deal-room document (angels only). Checks, on every request: a signed-in angel
// with deal access, a deal shared with members at a stage that shows this document.
// Redirects to a Supabase signed URL that expires after 60 seconds (streams the local
// file in development). Every open is logged in the angel's history.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readObject, signedObjectUrl } from "@/lib/deck-storage";
import { angelHasDealAccess, angelMayOpenDocument } from "@/lib/portal-deals";

export async function GET(req: Request, ctx: RouteContext<"/api/portal/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ANGEL" || !user.angelId) return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const [angel, allowed, doc] = await Promise.all([
    db.angel.findUnique({ where: { id: user.angelId } }),
    angelMayOpenDocument(id, user.angelId),
    db.document.findUnique({ where: { id }, select: { bucket: true, storagePath: true, fileName: true, mimeType: true } }),
  ]);
  if (!angel || !doc || !allowed || !(await angelHasDealAccess(angel))) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1" || doc.mimeType !== "application/pdf";
  await db.angelEvent.create({
    data: { angelId: angel.id, kind: "viewed-document", detail: `${allowed.ventureName}: ${doc.fileName}`, actorId: user.id },
  });

  const url = await signedObjectUrl(doc.bucket, doc.storagePath, doc.fileName, download);
  if (url) return Response.redirect(url, 302);
  const bytes = await readObject(doc.bucket, doc.storagePath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName.replace(/"/g, "")}"`,
    },
  });
}
