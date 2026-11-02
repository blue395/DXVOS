// A company's latest logo (team only), for thumbnails on the opportunities page.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/ventures/[id]/logo">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const logo = await db.ventureLogo.findFirst({ where: { ventureId: id }, orderBy: { createdAt: "desc" }, select: { mimeType: true, data: true } });
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: { "Content-Type": logo.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
