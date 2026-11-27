// The Angel Foundations course page (Blue, 2026-11-27): DXV's single-file course, served with
// the signed-in account so progress saves to it. Signed out: the sign-up page. Course-only
// learners answer "Which best describes you?" first. Education only: nothing here reads deals.
import { redirect } from "next/navigation";
import { COURSE_LOGO, COURSE_TEMPLATE } from "@/content/course/page.generated";
import { currentCourseUser } from "@/lib/auth";
import { buildCoursePage } from "@/lib/course";
import { ensureCourseLearner } from "@/lib/course-learners";
import { db } from "@/lib/db";
import { portalRibbonHtml } from "@/lib/portal-nav";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentCourseUser();
  if (!user) redirect("/learn/join");
  const learner = await ensureCourseLearner(user.id);
  if (user.role === "LEARNER" && !learner.describesAs) redirect("/learn/welcome");
  // Members and partners keep the portal's ribbon on the learning pages (Blue, 2026-11-27).
  const angel = user.angelId ? await db.angel.findUnique({ where: { id: user.angelId }, select: { name: true, onboardedAt: true, archivedAt: true } }) : null;
  const ribbon =
    angel && !angel.archivedAt ? portalRibbonHtml({ name: angel.name, partner: user.role === "ADMIN", showLinks: !!angel.onboardedAt, active: "/learn" }) : "";
  const html = buildCoursePage(COURSE_TEMPLATE, COURSE_LOGO, { id: user.id, name: user.name, ribbon: !!ribbon }, ribbon);
  return new Response(
    `<!doctype html>\n<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${html}\n</html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
    },
  );
}
