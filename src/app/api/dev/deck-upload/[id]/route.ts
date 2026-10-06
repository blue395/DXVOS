// LOCAL DEVELOPMENT ONLY: receives a deck upload when Supabase Storage isn't
// configured. In production the browser uploads straight to Supabase instead.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_DECK_BYTES, saveLocalDeck } from "@/lib/deck-storage";
import { SYSTEM_USER_ID } from "@/lib/founder-submissions";

export async function PUT(req: Request, ctx: RouteContext<"/api/dev/deck-upload/[id]">) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new Response("Not found", { status: 404 });
  }
  const { id } = await ctx.params;
  const [user, analysis] = await Promise.all([getCurrentUser(), db.deckAnalysis.findUnique({ where: { id } })]);
  if (!analysis || analysis.status !== "PENDING") return new Response("Unknown upload", { status: 404 });
  // The team's uploads, or a founder's from the public /apply page (filed by the website user).
  if (user?.role !== "ADMIN" && analysis.createdById !== SYSTEM_USER_ID) return new Response("Unauthorised", { status: 401 });

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DECK_BYTES) return new Response("Bad size", { status: 413 });
  await saveLocalDeck(analysis.storagePath, bytes);
  return new Response(null, { status: 204 });
}
