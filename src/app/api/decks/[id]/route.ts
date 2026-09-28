// Download the stored copy of a deck (admin only). Redirects to a Supabase signed
// URL that expires after 60 seconds; streams the local file in development.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readDeck, signedDownloadUrl } from "@/lib/deck-storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/decks/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });

  const { id } = await ctx.params;
  const analysis = await db.deckAnalysis.findUnique({ where: { id } });
  if (!analysis) return new Response("Not found", { status: 404 });

  const url = await signedDownloadUrl(analysis.storagePath, analysis.fileName);
  if (url) return Response.redirect(url, 302);

  const bytes = await readDeck(analysis.storagePath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${analysis.fileName.replace(/"/g, "")}"`,
    },
  });
}
