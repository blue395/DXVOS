"use server";

// Server actions for the Deals area. Every action:
//   1. calls requireAdmin() — actions are public HTTP endpoints, so each checks auth itself
//   2. validates input with zod
//   3. writes, then revalidates the pages that show that data
//
// Memo versions, pre-selection votes and stage history are create-only by design
// (append-only). EOIs and final investments can be edited and removed (Blue's decision,
// 2026-09-29), but every change is logged in EntryAudit and removed rows are only hidden.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CommsStatus, PassReason, Stage } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DomainError, moveVentureStage } from "@/lib/ventures";
import { recordDeckDocument } from "@/lib/deck-documents";
import type { ActionResult } from "@/lib/action-result";
import type { EntrySnapshot } from "@/lib/audit";
import { canDecline, latestVotePerAngel, normaliseAngelName, PASS_REASON_LABELS, stageLabel } from "@/lib/pipeline";
import { queueLessonSuggestions } from "@/lib/lesson-triggers";
import { angelIdForName } from "@/lib/angels";
import { founderDiversityFrom } from "@/components/founder-diversity-field";

// ── helpers ─────────────────────────────────────────────────────────────────

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .refine((s) => !s || /^https?:\/\//.test(s), "Links must start with http:// or https://");

const optionalPounds = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s.replace(/[£,\s]/g, ""))))
  .refine((n) => n === null || (Number.isInteger(n) && n >= 0), "Enter a whole number of pounds")
  .optional();

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}

function form(formData: FormData) {
  return Object.fromEntries(formData);
}

function revalidateDeal(ventureId: string) {
  revalidatePath(`/deals/${ventureId}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

// ── Venture ─────────────────────────────────────────────────────────────────

const VentureSchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  founderNames: optionalText,
  founderEmail: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .refine((s) => !s || z.email().safeParse(s).success, "Founder email isn't valid"),
  website: optionalUrl,
  sector: optionalText,
  companyStage: optionalText,
  raiseAmountGbp: optionalPounds,
  leadAngel: optionalText,
  round: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Choose a round")
    .optional(),
  description: optionalText,
});

export async function createVenture(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = VentureSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Creating the venture also writes its first stage-history row (from: null).
  const venture = await db.venture.create({
    data: {
      ...parsed.data,
      founderDiversity: founderDiversityFrom(formData),
      createdById: user.id,
      stageChanges: { create: { fromStage: null, toStage: "SUBMITTED", changedById: user.id } },
    },
  });

  // If the form was pre-filled from a deck, attach that AI analysis (and its stored
  // deck and eligibility screen) to the new venture.
  const analysisId = formData.get("analysisId");
  if (typeof analysisId === "string" && analysisId) {
    await db.deckAnalysis.updateMany({ where: { id: analysisId, ventureId: null }, data: { ventureId: venture.id } });
    await recordDeckDocument(analysisId); // and list the deck under the venture's Documents
  }
  revalidatePath("/deals");
  revalidatePath("/");
  redirect(`/deals/${venture.id}`);
}

export async function updateVenture(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = VentureSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await db.venture.update({ where: { id: ventureId }, data: { ...parsed.data, founderDiversity: founderDiversityFrom(formData) } });
  revalidateDeal(ventureId);
  return { ok: true };
}

// ── Stage moves ─────────────────────────────────────────────────────────────

const MoveSchema = z.object({
  to: z.enum(Stage),
  passReason: z.enum(PassReason).nullable().optional(),
  note: optionalText,
});

/** Called directly from the kanban board (not a form), hence the plain arguments. */
export async function moveVenture(
  ventureId: string,
  input: { to: Stage; passReason?: PassReason | null; note?: string | null },
): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = MoveSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };

  let moved;
  try {
    moved = await moveVentureStage({ ventureId, userId: user.id, ...parsed.data });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  // A decline is a learning moment: ask the AI to suggest lessons (best effort, reviewed in the Playbook).
  if (parsed.data.to === "PASSED" && moved.passedFromStage) {
    const reason = parsed.data.passReason ? PASS_REASON_LABELS[parsed.data.passReason] : "no reason given";
    await queueLessonSuggestions({
      ventureId,
      trigger: "DECLINED",
      moment: `Declined at ${stageLabel(moved.passedFromStage)}. Reason: ${reason}.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`,
      userId: user.id,
    });
  }
  revalidateDeal(ventureId);
  revalidatePath("/activity");
  return { ok: true };
}

/** Form wrapper around moveVenture for the deal page. */
export async function moveVentureForm(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const data = form(formData);
  return moveVenture(ventureId, {
    to: data.to as Stage,
    passReason: (data.passReason as PassReason) || null,
    note: (data.note as string) ?? null,
  });
}

// ── DD checklist (editable working state) ───────────────────────────────────

const DDItemSchema = z.object({
  title: z.string().trim().min(1, "Describe the DD item"),
  owner: optionalText,
  dueDate: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : new Date(`${s}T23:59:59`)))
    .optional(),
});

export async function addDDItem(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = DDItemSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await db.dDItem.create({ data: { ventureId, ...parsed.data } });
  revalidateDeal(ventureId);
  return { ok: true };
}

export async function toggleDDItem(itemId: string) {
  await requireAdmin();
  const item = await db.dDItem.findUniqueOrThrow({ where: { id: itemId } });
  await db.dDItem.update({ where: { id: itemId }, data: { completedAt: item.completedAt ? null : new Date() } });
  revalidateDeal(item.ventureId);
}

export async function deleteDDItem(itemId: string) {
  await requireAdmin();
  const item = await db.dDItem.delete({ where: { id: itemId } });
  revalidateDeal(item.ventureId);
}

// ── Votes (append-only, two distinct entities) ──────────────────────────────

const interestField = z.enum(["yes", "no"], { message: "Choose interested or not" }).transform((v) => v === "yes");

const PreSelectionSchema = z.object({
  angelName: z.string().trim().min(1, "Angel name is required"),
  interested: interestField,
  note: optionalText,
});

export async function addPreSelectionVote(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = PreSelectionSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await db.preSelectionVote.create({ data: { ventureId, recordedById: user.id, ...parsed.data, angelId: await angelIdForName(parsed.data.angelName) } });
  revalidateDeal(ventureId);
  return { ok: true };
}

const InvestmentVoteSchema = z
  .object({
    angelName: z.string().trim().min(1, "Angel name is required"),
    interested: interestField,
    maxTicketGbp: optionalPounds,
    note: optionalText,
  })
  .refine((v) => !v.interested || (v.maxTicketGbp ?? 0) > 0, {
    message: "Interested angels need a max ticket size",
  });

export async function addInvestmentVote(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = InvestmentVoteSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { maxTicketGbp, ...rest } = parsed.data;
  await db.investmentVote.create({
    data: { ventureId, recordedById: user.id, maxTicketGbp: rest.interested ? (maxTicketGbp ?? 0) : 0, ...rest, angelId: await angelIdForName(rest.angelName) },
  });
  revalidateDeal(ventureId);
  return { ok: true };
}

type EoiRow = { angelName: string; interested: boolean; maxTicketGbp: number; note: string | null };
const eoiSnapshot = (v: EoiRow): EntrySnapshot => ({
  angelName: v.angelName,
  interested: v.interested,
  maxTicketGbp: v.maxTicketGbp,
  note: v.note,
});

/** Correct an EOI in place. The previous values are kept in the audit log. */
export async function updateInvestmentVote(voteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = InvestmentVoteSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const vote = await db.investmentVote.findUnique({ where: { id: voteId } });
  if (!vote || vote.removedAt) return { error: "This entry no longer exists." };

  const { maxTicketGbp, ...rest } = parsed.data;
  const next = { ...rest, maxTicketGbp: rest.interested ? (maxTicketGbp ?? 0) : 0, note: rest.note ?? null };
  await db.$transaction([
    db.investmentVote.update({ where: { id: voteId }, data: { ...next, angelId: await angelIdForName(next.angelName), editedAt: new Date() } }),
    db.entryAudit.create({
      data: {
        ventureId: vote.ventureId,
        entity: "INVESTMENT_VOTE",
        entryId: voteId,
        action: "EDIT",
        before: eoiSnapshot(vote),
        after: eoiSnapshot(next),
        changedById: user.id,
      },
    }),
  ]);
  revalidateDeal(vote.ventureId);
  return { ok: true };
}

/** Hide an EOI from the list and totals. It stays in the database and the audit log. */
export async function removeInvestmentVote(voteId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const vote = await db.investmentVote.findUnique({ where: { id: voteId } });
  if (!vote || vote.removedAt) return { error: "This entry no longer exists." };
  await db.$transaction([
    db.investmentVote.update({ where: { id: voteId }, data: { removedAt: new Date(), removedById: user.id } }),
    db.entryAudit.create({
      data: { ventureId: vote.ventureId, entity: "INVESTMENT_VOTE", entryId: voteId, action: "REMOVE", before: eoiSnapshot(vote), changedById: user.id },
    }),
  ]);
  revalidateDeal(vote.ventureId);
  return { ok: true };
}

// ── Final investment (actual tickets, and whether they're paid) ─────────────

const FinalInvestmentSchema = z.object({
  angelName: z.string().trim().min(1, "Angel name is required"),
  ticketGbp: optionalPounds.refine((n) => (n ?? 0) > 0, "Enter the ticket size"),
  note: optionalText,
  paid: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

type FinalRow = { angelName: string; ticketGbp: number; note: string | null; paidAt: Date | null };
const finalSnapshot = (f: FinalRow): EntrySnapshot => ({
  angelName: f.angelName,
  ticketGbp: f.ticketGbp,
  paid: !!f.paidAt,
  note: f.note,
});

export async function addFinalInvestment(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = FinalInvestmentSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { paid, ticketGbp, ...rest } = parsed.data;
  await db.finalInvestment.create({
    data: {
      ventureId,
      ...rest,
      angelId: await angelIdForName(rest.angelName),
      ticketGbp: ticketGbp!,
      createdById: user.id,
      ...(paid ? { paidAt: new Date(), paidById: user.id } : {}),
    },
  });
  revalidateDeal(ventureId);
  return { ok: true };
}

/** Correct an angel's final ticket (payment is ticked separately). Logged. */
export async function updateFinalInvestment(entryId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = FinalInvestmentSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const entry = await db.finalInvestment.findUnique({ where: { id: entryId } });
  if (!entry || entry.removedAt) return { error: "This entry no longer exists." };

  const next = { angelName: parsed.data.angelName, ticketGbp: parsed.data.ticketGbp!, note: parsed.data.note ?? null };
  await db.$transaction([
    db.finalInvestment.update({ where: { id: entryId }, data: { ...next, angelId: await angelIdForName(next.angelName), editedAt: new Date() } }),
    db.entryAudit.create({
      data: {
        ventureId: entry.ventureId,
        entity: "FINAL_INVESTMENT",
        entryId,
        action: "EDIT",
        before: finalSnapshot(entry),
        after: finalSnapshot({ ...next, paidAt: entry.paidAt }),
        changedById: user.id,
      },
    }),
  ]);
  revalidateDeal(entry.ventureId);
  return { ok: true };
}

/** Tick (or untick) that an angel's money has arrived. Logged. */
export async function setFinalInvestmentPaid(entryId: string, paid: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  const entry = await db.finalInvestment.findUnique({ where: { id: entryId } });
  if (!entry || entry.removedAt) return { error: "This entry no longer exists." };
  if (!!entry.paidAt === paid) return { ok: true };
  await db.$transaction([
    db.finalInvestment.update({
      where: { id: entryId },
      data: paid ? { paidAt: new Date(), paidById: user.id } : { paidAt: null, paidById: null },
    }),
    db.entryAudit.create({
      data: {
        ventureId: entry.ventureId,
        entity: "FINAL_INVESTMENT",
        entryId,
        action: paid ? "PAID" : "UNPAID",
        before: finalSnapshot(entry),
        changedById: user.id,
      },
    }),
  ]);
  revalidateDeal(entry.ventureId);
  return { ok: true };
}

export async function removeFinalInvestment(entryId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const entry = await db.finalInvestment.findUnique({ where: { id: entryId } });
  if (!entry || entry.removedAt) return { error: "This entry no longer exists." };
  await db.$transaction([
    db.finalInvestment.update({ where: { id: entryId }, data: { removedAt: new Date(), removedById: user.id } }),
    db.entryAudit.create({
      data: { ventureId: entry.ventureId, entity: "FINAL_INVESTMENT", entryId, action: "REMOVE", before: finalSnapshot(entry), changedById: user.id },
    }),
  ]);
  revalidateDeal(entry.ventureId);
  return { ok: true };
}

/** Start the final list from the EOIs: each interested angel at their max ticket (skips names already listed). */
export async function addFinalFromEois(ventureId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const [votes, existing] = await Promise.all([
    db.investmentVote.findMany({ where: { ventureId, removedAt: null } }),
    db.finalInvestment.findMany({ where: { ventureId, removedAt: null }, select: { angelName: true } }),
  ]);
  const listed = new Set(existing.map((e) => normaliseAngelName(e.angelName)));
  const toAdd = latestVotePerAngel(votes).filter((v) => v.interested && v.maxTicketGbp > 0 && !listed.has(normaliseAngelName(v.angelName)));
  if (toAdd.length === 0) return { error: "No interested angels from the EOIs left to add." };
  await db.finalInvestment.createMany({
    data: toAdd.map((v) => ({ ventureId, angelName: v.angelName, angelId: v.angelId, ticketGbp: v.maxTicketGbp, note: "From EOI", createdById: user.id })),
  });
  revalidateDeal(ventureId);
  return { ok: true };
}

// ── Decline (from the deal page's Decline pill) ─────────────────────────────

const DeclineSchema = z.object({ passReason: z.enum(PassReason, { message: "Choose a reason" }), note: optionalText });

export async function declineVenture(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = DeclineSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const venture = await db.venture.findUnique({ where: { id: ventureId }, select: { currentStage: true } });
  if (!venture || !canDecline(venture.currentStage)) return { error: "This deal can't be declined at its current stage." };
  return moveVenture(ventureId, { to: "PASSED", passReason: parsed.data.passReason, note: parsed.data.note ?? null });
}

// ── Founder comms ───────────────────────────────────────────────────────────

const CommSchema = z.object({
  status: z.enum(CommsStatus),
  note: optionalText,
});

export async function updateFounderComm(commId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = CommSchema.safeParse(form(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { status, note } = parsed.data;

  const existing = await db.founderComm.findUniqueOrThrow({ where: { id: commId } });
  const now = new Date();

  // Record who sent it and when, the first time it's marked Sent (or skipped straight
  // to Acknowledged). Moving back to Not yet sent clears those fields.
  const sent = status !== "NOT_YET_SENT";
  await db.founderComm.update({
    where: { id: commId },
    data: {
      status,
      note,
      sentAt: sent ? (existing.sentAt ?? now) : null,
      sentById: sent ? (existing.sentById ?? user.id) : null,
      acknowledgedAt: status === "FOUNDER_ACKNOWLEDGED" ? (existing.acknowledgedAt ?? now) : null,
    },
  });
  revalidateDeal(existing.ventureId);
  return { ok: true };
}
