// The approved opportunities pack for the round open to members (angels, and partners using
// the portal as their angel record). Checked on every request: deal access (current investor
// statement), an approved pack, for the round members can see now. Every open is logged.
import { getCurrentUser, hasMemberAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvedPackFor, opportunityPackPdf } from "@/lib/opportunity-packs";
import { angelHasDealAccess, currentMemberRound } from "@/lib/portal-deals";
import { trackPortalView } from "@/lib/portal-analytics";

export async function GET(req: Request, ctx: RouteContext<"/api/portal/opportunities/[id]">) {
  const user = await getCurrentUser();
  if (!user || !hasMemberAccess(user) || !user.angelId) return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const [angel, round] = await Promise.all([db.angel.findUnique({ where: { id: user.angelId } }), currentMemberRound()]);
  if (!angel || !(await angelHasDealAccess(angel))) return new Response("Not found", { status: 404 });
  // Only the latest approved pack of the round open to members.
  const pack = await approvedPackFor(round);
  if (!pack || pack.id !== id) return new Response("Not found", { status: 404 });
  const pdf = await opportunityPackPdf(id, { approvedOnly: true });
  if (!pdf) return new Response("Not found", { status: 404 });
  await Promise.all([
    db.angelEvent.create({ data: { angelId: angel.id, kind: "viewed-document", detail: `Opportunities pack: ${pack.title}`, actorId: user.id } }),
    trackPortalView({ user, angel }, "DOCUMENT"),
  ]);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
