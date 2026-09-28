// Open or download a stored document (admin only). Redirects to a Supabase signed
// URL that expires after 60 seconds; streams the local file in development.
// ?download=1 forces a download; otherwise PDFs open in the browser.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readObject, signedObjectUrl } from "@/lib/deck-storage";

export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });

  const { id } = await ctx.params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || !doc.uploadedAt) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1" || doc.mimeType !== "application/pdf";

  const url = await signedObjectUrl(doc.bucket, doc.storagePath, doc.fileName, download);
  if (url) return Response.redirect(url, 302);

  const bytes = await readObject(doc.bucket, doc.storagePath);
  const safeName = doc.fileName.replace(/"/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
    },
  });
}
