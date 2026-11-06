"use server";

// Which round members see on their deals board, and when its pitch-selection vote closes.
// Append-only (MemberRound): the latest row counts.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";
import { londonLocalToDate, roundOpenedAt } from "@/lib/pipeline";
import { loadVoteRounds } from "@/lib/portal-deals";

function revalidateRound() {
  revalidatePath("/");
  revalidatePath("/portal");
  revalidatePath("/portal/deals", "layout");
  revalidatePath("/deals/angel-votes");
}

export async function setMemberRound(round: number | null): Promise<ActionResult> {
  const user = await requireAdmin();
  if (round !== null && (!Number.isInteger(round) || round < 1 || round > 99)) return { error: "Choose a round." };
  // A different round starts without a deadline; re-choosing the same round keeps its deadline.
  const rounds = await loadVoteRounds();
  const latest = rounds.current;
  const votingClosesAt = round !== null && latest?.round === round ? latest.votingClosesAt : null;
  // A round whose voting was already opened stays open (only votes from that opening count).
  await db.memberRound.create({ data: { round, votingClosesAt, votingOpenedAt: roundOpenedAt(round, rounds), byId: user.id } });
  revalidateRound();
  return { ok: true };
}

/** Set (or clear, when blank) the deadline for the round open to members. The time is UK time. */
export async function setVotingDeadline(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const raw = String(formData.get("votingClosesAt") ?? "").trim();
  const votingClosesAt = raw ? londonLocalToDate(raw) : null;
  if (raw && !votingClosesAt) return { error: "Enter a date and time." };
  const latest = await db.memberRound.findFirst({ orderBy: { createdAt: "desc" }, select: { round: true, votingOpenedAt: true } });
  if (latest?.round == null) return { error: "Choose the round open to members first." };
  await db.memberRound.create({ data: { round: latest.round, votingClosesAt, votingOpenedAt: latest.votingOpenedAt, byId: user.id } });
  revalidateRound();
  return { ok: true };
}
