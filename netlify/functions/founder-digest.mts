// Netlify Scheduled Function: every morning, ask DXV OS to email the partners a digest of
// new founder submissions (nothing is sent on days with none). 07:00 UTC = 8am in the UK
// summer, 7am in winter. Scheduled functions only run on the published production site.
import type { Config } from "@netlify/functions";
import { createWorkerToken } from "../../src/lib/worker-auth";

const handler = async () => {
  const secret = process.env.SESSION_SECRET;
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/+$/, "");
  if (!secret || !base) {
    console.error("Founder digest: SESSION_SECRET and APP_URL (or URL) are needed");
    return;
  }
  const res = await fetch(`${base}/api/cron/founder-digest`, { method: "POST", headers: { "x-dxv-worker-token": createWorkerToken("founder-digest", secret) } });
  console.log("Founder digest:", res.status, await res.text());
};

export default handler;

export const config: Config = { schedule: "0 7 * * *" };
