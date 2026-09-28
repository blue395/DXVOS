// LOCAL DEVELOPMENT ONLY: receives a deck upload when Supabase Storage isn't
// configured. In production the browser uploads straight to Supabase instead.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_DECK_BYTES, saveLocalDeck } from "@/lib/deck-storage";

export async function PUT(req: Request, ctx: RouteContext<"/api/dev/deck-upload/[id]">) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response("Not found", { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });

  const { id } = await ctx.params;
  const analysis = await db.deckAnalysis.findUnique({ where: { id } });
  if (!analysis || analysis.status !== "PENDING") return new Response("Unknown upload", { status: 404 });

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DECK_BYTES) return new Response("Bad size", { status: 413 });
  await saveLocalDeck(analysis.storagePath, bytes);
  return new Response(null, { status: 204 });
}
