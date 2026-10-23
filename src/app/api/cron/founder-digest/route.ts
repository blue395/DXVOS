// The partners' daily founder-submissions digest. Called each morning by the Netlify
// scheduled function netlify/functions/founder-digest.mts with a short-lived signed token
// (subject "founder-digest"); anything else is refused. Team members can also send it
// now from Deals → Website submissions. It also runs the daily retention jobs
// (src/lib/retention.ts, docs/privacy retention schedule).
import { sendFounderDigest } from "@/lib/founder-submissions";
import { runRetention } from "@/lib/retention";
import { verifyWorkerToken } from "@/lib/worker-auth";

const DIGEST_SUBJECT = "founder-digest";

export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  const subject = secret ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (subject !== DIGEST_SUBJECT) return new Response("Unauthorised", { status: 401 });
  const [digest, retention] = await Promise.all([sendFounderDigest(), runRetention()]);
  return Response.json({ digest, retention }); // counts only
}
