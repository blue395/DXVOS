// Netlify Background Function: writes a Partner Review round summary (up to 15 minutes).
// Triggered by the app with a signed token whose subject is "round-summary:<summaryId>".
import { ROUND_SUMMARY_JOB_PREFIX, runRoundSummary } from "../../src/lib/round-summary-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(ROUND_SUMMARY_JOB_PREFIX)) {
    console.warn("Rejected round summary worker call without a valid token");
    return;
  }
  await runRoundSummary(subject.slice(ROUND_SUMMARY_JOB_PREFIX.length));
};

export default handler;
