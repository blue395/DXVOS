import "server-only";
import type { PassReason, Stage } from "@/generated/prisma/enums";
import { db } from "./db";
import { gatesCrossed } from "./pipeline";

export class DomainError extends Error {}

/**
 * Move a venture to a new stage. The single place stage changes happen, so the
 * venture, its stage history and its owed founder comms can never disagree.
 */
export async function moveVentureStage(opts: {
  ventureId: string;
  to: Stage;
  userId: string;
  passReason?: PassReason | null;
  note?: string | null;
}) {
  const { ventureId, to, userId } = opts;
  const note = opts.note?.trim() || null;
  const passReason = to === "PASSED" ? (opts.passReason ?? null) : null;

  if (to === "PASSED" && !passReason) throw new DomainError("A reason is required to pass on a deal.");
  if (passReason === "OTHER" && !note) throw new DomainError('Add a note explaining the "Other" reason.');

  return db.$transaction(async (tx) => {
    const venture = await tx.venture.findUniqueOrThrow({ where: { id: ventureId } });
    const from = venture.currentStage;
    if (from === to) return venture;

    const now = new Date();
    const updated = await tx.venture.update({
      where: { id: ventureId },
      data: {
        currentStage: to,
        stageEnteredAt: now,
        passReason,
        passNote: to === "PASSED" ? note : null,
      },
    });

    await tx.stageChange.create({
      data: { ventureId, fromStage: from, toStage: to, passReason, note, changedById: userId, changedAt: now },
    });

    // One comm per (venture, gate). If one already exists (e.g. the deal went back
    // and forward again) we keep it as-is rather than wiping its Sent status.
    for (const owed of gatesCrossed(from, to, passReason)) {
      await tx.founderComm.upsert({
        where: { ventureId_gate: { ventureId, gate: owed.gate } },
        create: { ventureId, gate: owed.gate, decision: owed.decision },
        update: {},
      });
    }

    return updated;
  });
}
