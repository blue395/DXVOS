// The signed-in person's DXV Brain chats (newest first), for the chat panel's history.
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Unauthorised" }, { status: 401 });
  const chats = await db.brainConversation.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, title: true, updatedAt: true },
  });
  return Response.json({ chats }, { headers: { "Cache-Control": "no-store" } });
}
