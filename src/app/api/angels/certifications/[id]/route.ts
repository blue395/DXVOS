// Open or download an angel's signed investor statement (admin only). Certification
// files are sensitive: served only through this check, via a 60-second signed link.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readObject, signedObjectUrl } from "@/lib/deck-storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/angels/certifications/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const cert = await db.angelCertification.findUnique({ where: { id } });
  if (!cert?.bucket || !cert.storagePath || !cert.fileName) return new Response("Not found", { status: 404 });
  const inline = cert.mimeType === "application/pdf";
  const url = await signedObjectUrl(cert.bucket, cert.storagePath, cert.fileName, !inline);
  if (url) return Response.redirect(url, 302);
  const bytes = await readObject(cert.bucket, cert.storagePath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": cert.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${cert.fileName.replace(/"/g, "")}"`,
    },
  });
}
