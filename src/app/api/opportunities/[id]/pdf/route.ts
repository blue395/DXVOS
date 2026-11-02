// The opportunities pack as a PDF for the team (draft or approved; drafts are marked on
// every slide). Members get approved packs only, through /api/portal/opportunities.
import { getCurrentUser } from "@/lib/auth";
import { opportunityPackPdf } from "@/lib/opportunity-packs";

export async function GET(req: Request, ctx: RouteContext<"/api/opportunities/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  const pdf = await opportunityPackPdf(id, { approvedOnly: false });
  if (!pdf) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
