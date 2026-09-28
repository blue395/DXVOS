import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysSince, dealWarnings } from "@/lib/pipeline";
import { buttonClass } from "@/components/ui";
import { KanbanBoard, type BoardCard } from "./kanban-board";

export default async function DealsPage() {
  await requireAdmin();

  const ventures = await db.venture.findMany({
    orderBy: { stageEnteredAt: "asc" }, // longest-waiting first within each column
    select: {
      id: true,
      name: true,
      sector: true,
      round: true,
      currentStage: true,
      stageEnteredAt: true,
      ddItems: { select: { dueDate: true, completedAt: true } },
      _count: { select: { founderComms: { where: { status: "NOT_YET_SENT" } } } },
    },
  });

  const now = new Date();
  // Shape exactly what the client needs — nothing more crosses to the browser.
  const cards: BoardCard[] = ventures.map((v) => ({
    id: v.id,
    name: v.name,
    sector: v.sector,
    round: v.round,
    currentStage: v.currentStage,
    daysInStage: daysSince(v.stageEnteredAt, now),
    warnings: dealWarnings(v, now),
    commsOwed: v._count.founderComms,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Deals</h1>
          <p className="text-sm text-black/60">Drag a card to move it between stages. Every move is logged.</p>
        </div>
        <Link href="/deals/new" className={buttonClass("accent")}>
          + New venture
        </Link>
      </div>
      <KanbanBoard initialCards={cards} />
    </div>
  );
}
