// The signed-in login's own course progress (Angel Foundations). Never anyone else's: the id
// comes from the session only.
import { currentCourseUser } from "@/lib/auth";
import { ProgressSave } from "@/lib/course";
import { loadCourseProgress, saveCourseProgress } from "@/lib/course-learners";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentCourseUser();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  return Response.json(await loadCourseProgress(user.id), { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await currentCourseUser();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  // Same-site only (the session cookie is SameSite=Lax; this is a second check).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const text = await request.text();
  if (text.length > 400_000) return Response.json({ error: "Too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const parsed = ProgressSave.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const ok = await saveCourseProgress(user.id, parsed.data.lessons);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Bad request" }, { status: 400 });
}
