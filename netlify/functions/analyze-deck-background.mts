// Netlify Background Function (the "-background" suffix makes it one): Netlify
// replies 202 immediately and lets this run for up to 15 minutes, which reading
// a deck with Claude can need. Triggered by the app with a signed token.
import { runDeckAnalysis } from "../../src/lib/deck-worker";
import { verifyWorkerToken } from "../../src/lib/worker-auth";

const handler = async (req: Request) => {
  const secret = process.env.SESSION_SECRET;
  const token = req.headers.get("x-dxv-worker-token") ?? "";
  const analysisId = secret && req.method === "POST" ? verifyWorkerToken(token, secret) : null;
  if (!analysisId || analysisId.includes(":")) {
    // (a "memo:" token is for the memo worker, not this one)
    console.warn("Rejected deck worker call without a valid token");
    return;
  }
  await runDeckAnalysis(analysisId);
};

export default handler;
