// Which deploy is live, so open pages can tell when DXV OS has been updated.
// Public (no data), and never cached.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: process.env.NEXT_PUBLIC_DEPLOY_ID ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}
