// Netlify Background Function: the AI suggests lessons from a moment in a deal.
// Triggered by the app with a signed token whose subject is "lesson:<jobId>".
import { LESSON_JOB_PREFIX, runLessonJob } from "../../src/lib/lesson-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(LESSON_JOB_PREFIX)) {
    console.warn("Rejected lesson worker call without a valid token");
    return;
  }
  await runLessonJob(subject.slice(LESSON_JOB_PREFIX.length));
};

export default handler;
