// Sign out from a plain HTML form (the ribbon on the learning pages, which aren't React pages).
import { deleteSession } from "@/lib/session";

export async function POST(request: Request) {
  // Same site only (the session cookie is SameSite=Lax anyway).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  await deleteSession();
  return new Response(null, { status: 303, headers: { location: "/login" } });
}
