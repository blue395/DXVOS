"use server";

// Server actions for the Deals area. Every action:
//   1. calls requireAdmin() — actions are public HTTP endpoints, so each checks auth itself
//   2. validates input with zod
//   3. writes, then revalidates the pages that show that data
//
// Votes, memo versions and stage history are create-only here by design (append-only).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CommsStatus, PassReason, Stage } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DomainError, moveVentureStage } from "@/lib/ventures";
import { recordDeckDocument } from "@/lib/deck-documents";
import type { ActionResult } from "@/lib/action-result";

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
  investedAmountGbp: optionalPounds,
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

  await db.venture.update({ where: { id: ventureId }, data: parsed.data });
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

  try {
    await moveVentureStage({ ventureId, userId: user.id, ...parsed.data });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
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

  await db.preSelectionVote.create({ data: { ventureId, recordedById: user.id, ...parsed.data } });
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
    data: { ventureId, recordedById: user.id, maxTicketGbp: rest.interested ? (maxTicketGbp ?? 0) : 0, ...rest },
  });
  revalidateDeal(ventureId);
  return { ok: true };
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
