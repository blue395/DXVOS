// Netlify Background Function: drafts an AI investment memo (up to 15 minutes).
// Triggered by the app with a signed token whose subject is "memo:<analysisId>".
import { MEMO_JOB_PREFIX, runMemoAnalysis } from "../../src/lib/memo-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(MEMO_JOB_PREFIX)) {
    console.warn("Rejected memo worker call without a valid token");
    return;
  }
  await runMemoAnalysis(subject.slice(MEMO_JOB_PREFIX.length));
};

export default handler;
