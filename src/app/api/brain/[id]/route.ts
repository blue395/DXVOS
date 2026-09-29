// One DXV Brain chat, as the panel shows it. Private: only its owner can read it. The
// panel polls this while a reply is being written (the text is saved as it streams).
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import type { BrainChat } from "@/lib/brain/view";

export async function GET(_req: Request, ctx: RouteContext<"/api/brain/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const chat = await db.brainConversation.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: [{ createdAt: "asc" }, { role: "asc" }],
        select: { id: true, role: true, text: true, status: true, activity: true, sources: true, error: true, createdAt: true, startedAt: true },
      },
    },
  });
  if (!chat) return Response.json({ error: "Not found" }, { status: 404 });
  const body: BrainChat = {
    id: chat.id,
    title: chat.title,
    messages: chat.messages.map((m) => {
      const eff = effectiveDeckStatus(m);
      return {
        id: m.id,
        role: m.role,
        text: m.text,
        status: eff.status,
        activity: m.activity,
        error: eff.error,
        sources: (m.sources as BrainChat["messages"][number]["sources"]) ?? [],
      };
    }),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
