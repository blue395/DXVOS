// Netlify Background Function: drafts the DXV Due Diligence document (up to 15 minutes).
// Triggered by the app with a signed token whose subject is "dd:<jobId>".
import { DD_JOB_PREFIX, runDDReport } from "../../src/lib/dd-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(DD_JOB_PREFIX)) {
    console.warn("Rejected DD worker call without a valid token");
    return;
  }
  await runDDReport(subject.slice(DD_JOB_PREFIX.length));
};

export default handler;
