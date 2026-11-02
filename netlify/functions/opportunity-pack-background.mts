// Netlify Background Function: drafts a members' opportunities pack (up to 15 minutes).
// Triggered by the app with a signed token whose subject is "opportunities:<packId>".
import { OPPORTUNITY_JOB_PREFIX, runOpportunityPack } from "../../src/lib/opportunity-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const subject = secret && req.method === "POST" ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (!subject?.startsWith(OPPORTUNITY_JOB_PREFIX)) {
    console.warn("Rejected opportunities worker call without a valid token");
    return;
  }
  await runOpportunityPack(subject.slice(OPPORTUNITY_JOB_PREFIX.length));
};

export default handler;
