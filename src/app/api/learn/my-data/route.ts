// "Download my course data": everything the course holds about the signed-in login, as JSON.
import { currentCourseUser } from "@/lib/auth";
import { exportCourseData } from "@/lib/course-learners";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentCourseUser();
  if (!user) return new Response("Sign in", { status: 401 });
  const data = await exportCourseData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="my-angel-foundations-data.json"',
      "cache-control": "private, no-store",
    },
  });
}
