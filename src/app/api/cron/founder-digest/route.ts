// The partners' daily founder-submissions digest. Called each morning by the Netlify
// scheduled function netlify/functions/founder-digest.mts with a short-lived signed token
// (subject "founder-digest"); anything else is refused. Team members can also send it
// now from Deals → Website submissions. It also does the daily housekeeping: password
// sign-in attempts are kept 30 days (they're only for slowing down password guessing).
import { db } from "@/lib/db";
import { sendFounderDigest } from "@/lib/founder-submissions";
import { verifyWorkerToken } from "@/lib/worker-auth";

const DIGEST_SUBJECT = "founder-digest";

export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  const subject = secret ? verifyWorkerToken(req.headers.get("x-dxv-worker-token") ?? "", secret) : null;
  if (subject !== DIGEST_SUBJECT) return new Response("Unauthorised", { status: 401 });
  const [digest] = await Promise.all([
    sendFounderDigest(),
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } }),
  ]);
  return Response.json(digest);
}
