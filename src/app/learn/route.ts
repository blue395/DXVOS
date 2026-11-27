// The Angel Foundations course page (Blue, 2026-11-27): DXV's single-file course, served with
// the signed-in account so progress saves to it. Signed out: the sign-up page. Course-only
// learners answer "Which best describes you?" first. Education only: nothing here reads deals.
import { redirect } from "next/navigation";
import { COURSE_LOGO, COURSE_TEMPLATE } from "@/content/course/page.generated";
import { currentCourseUser } from "@/lib/auth";
import { buildCoursePage } from "@/lib/course";
import { ensureCourseLearner } from "@/lib/course-learners";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentCourseUser();
  if (!user) redirect("/learn/join");
  const learner = await ensureCourseLearner(user.id);
  if (user.role === "LEARNER" && !learner.describesAs) redirect("/learn/welcome");
  const html = buildCoursePage(COURSE_TEMPLATE, COURSE_LOGO, {
    id: user.id,
    name: user.name,
    portal: user.angelId ? "/portal" : null,
  });
  return new Response(
    `<!doctype html>\n<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${html}\n</html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
    },
  );
}
