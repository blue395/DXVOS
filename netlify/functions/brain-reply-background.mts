// Netlify Background Function: writes one DXV Brain reply (up to 15 minutes).
// Triggered by the app with a signed token whose subject is "brain:<messageId>".
import { BRAIN_JOB_PREFIX, runBrainReply } from "../../src/lib/brain-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(BRAIN_JOB_PREFIX)) {
    console.warn("Rejected Brain worker call without a valid token");
    return;
  }
  await runBrainReply(subject.slice(BRAIN_JOB_PREFIX.length));
};

export default handler;
