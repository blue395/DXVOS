"use server";

// The angel portal's actions. Each calls requireAngel() and only ever touches the
// signed-in angel's own record (the id comes from the session, never from the form).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATEMENT_CERT_TYPE } from "@/lib/compliance-texts";
import { certificationExpiry, EXPERIENCE_LEVELS, latestCertification, nextOnboardingStep, parseList, TICKET_RANGES } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";
import { angelHasDealAccess, loadDealRoom } from "@/lib/portal-deals";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable()
    .optional();

const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: text(40),
  location: text(120),
  linkedinUrl: text(300).refine((s) => !s || /^https?:\/\//.test(s), "LinkedIn links start with https://"),
  bio: text(2000),
  source: text(200),
  ticketRange: z.enum([...TICKET_RANGES, ""]).optional(),
  experience: z.enum([...EXPERIENCE_LEVELS, ""]).optional(),
});

/** Where to go after a step: the next onboarding step, or home. */
async function nextPath(angelId: string) {
  const a = await db.angel.findUniqueOrThrow({ where: { id: angelId }, include: { certifications: { select: { signedOn: true, expiresOn: true } } } });
  const step = nextOnboardingStep(a, latestCertification(a.certifications));
  return step === "done" ? "/portal" : `/portal/${step}`;
}

export async function updateMyProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { ticketRange, experience, ...rest } = parsed.data;
  // Sectors: the ticked suggestions plus anything typed in "Other".
  const sectors = parseList([...formData.getAll("sector").map(String), String(formData.get("otherSectors") ?? "")].join(","));
  const tags = parseList([...formData.getAll("tag").map(String), String(formData.get("otherTags") ?? "")].join(","));
  const first = !angel.profileConfirmedAt;
  await db.$transaction([
    db.angel.update({
      where: { id: angel.id },
      data: {
        ...rest,
        source: angel.source ?? rest.source, // how they found DXV: asked once
        ticketRange: ticketRange || null,
        experience: experience || null,
        sectors,
        tags,
        profileConfirmedAt: angel.profileConfirmedAt ?? new Date(),
        updatedById: user.id,
      },
    }),
    db.angelEvent.create({ data: { angelId: angel.id, kind: first ? "profile-confirmed" : "profile-updated", actorId: user.id } }),
  ]);
  revalidatePath("/portal");
  if (first) redirect(await nextPath(angel.id));
  return { ok: true };
}

const SignSchema = z.object({
  textId: z.string().min(1, "Choose a statement"),
  signatureName: z.string().trim().min(2, "Type your full name to sign").max(120),
  confirm: z.literal("on", { message: "Tick the box to confirm the statement is true" }),
});

/** Sign the chosen investor statement (the approved wording in use right now). */
export async function signStatement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  const parsed = SignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const text = await db.complianceText.findUnique({ where: { id: parsed.data.textId } });
  if (!text || text.status !== "APPROVED" || text.kind === "MEMBER_TERMS") return { error: "That statement has been updated. Reload the page and sign the current version." };
  const ticked = formData.getAll(`criterion`).map(String);
  const criteria = text.criteria.filter((c) => ticked.includes(c));
  if (criteria.length === 0) return { error: "Tick the criterion (or criteria) that apply to you." };

  const type = STATEMENT_CERT_TYPE[text.kind];
  const signedOn = new Date();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.$transaction([
    db.angelCertification.create({
      data: {
        angelId: angel.id,
        type,
        signedOn,
        expiresOn: certificationExpiry(type, signedOn),
        note: "Signed in the member portal",
        recordedById: user.id,
        signedByAngel: true,
        complianceTextId: text.id,
        criteria,
        signatureName: parsed.data.signatureName,
        ipAddress: ip,
      },
    }),
    db.angel.update({ where: { id: angel.id }, data: { restrictedDeclaredAt: null } }),
    db.angelEvent.create({ data: { angelId: angel.id, kind: "statement-signed", detail: `${text.title}, version ${text.version}`, actorId: user.id } }),
  ]);
  revalidatePath("/portal");
  redirect(await nextPath(angel.id));
}

/** "None of these applies to me": the portal without deal content. */
export async function declareRestricted(): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  await db.$transaction([
    db.angel.update({ where: { id: angel.id }, data: { restrictedDeclaredAt: new Date() } }),
    db.angelEvent.create({ data: { angelId: angel.id, kind: "no-exemption-declared", detail: "Said neither statement applies to them", actorId: user.id } }),
  ]);
  redirect(await nextPath(angel.id));
}

export async function finishOnboarding(): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  const next = await nextPath(angel.id);
  if (next !== "/portal/welcome" && next !== "/portal") redirect(next); // no skipping the profile or statement
  if (!angel.onboardedAt) {
    await db.$transaction([
      db.angel.update({ where: { id: angel.id }, data: { onboardedAt: new Date() } }),
      db.angelEvent.create({ data: { angelId: angel.id, kind: "onboarded", actorId: user.id } }),
    ]);
  }
  redirect("/portal");
}

// ── Deal room votes ─────────────────────────────────────────────────────────
// Recorded straight into the deal's Pre-Selection votes and Commitments (EOIs), as the
// signed-in angel. Checked on every call: deal access, the deal shared and at a stage
// that takes this vote.

async function votableDeal(ventureId: string, kind: "pre-selection" | "eoi") {
  const { user, angel } = await requireAngel();
  if (!(await angelHasDealAccess(angel))) return { error: "Deals are open to members with a current investor statement." } as const;
  const room = await loadDealRoom(ventureId, angel.id);
  if (!room || room.voteKind !== kind) return { error: "This vote has closed. Reload the page to see where the deal is now." } as const;
  return { user, angel, room } as const;
}

function revalidateVote(ventureId: string) {
  revalidatePath(`/portal/deals/${ventureId}`);
  revalidatePath(`/deals/${ventureId}`);
}

const VoteNote = z.string().trim().max(1000).optional().transform((s) => s || null);

export async function castPreSelectionVote(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ interested: z.enum(["yes", "no"], { message: "Choose yes or no" }), note: VoteNote }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const ctx = await votableDeal(ventureId, "pre-selection");
  if ("error" in ctx) return { error: ctx.error };
  const interested = parsed.data.interested === "yes";
  await db.$transaction([
    db.preSelectionVote.create({
      data: { ventureId, angelName: ctx.angel.name, angelId: ctx.angel.id, interested, note: parsed.data.note, recordedById: ctx.user.id },
    }),
    db.angelEvent.create({
      data: { angelId: ctx.angel.id, kind: "pitch-selection-vote", detail: `${ctx.room.name}: ${interested ? "interested" : "not interested"}`, actorId: ctx.user.id },
    }),
  ]);
  revalidateVote(ventureId);
  return { ok: true };
}

const EoiSchema = z
  .object({
    interested: z.enum(["yes", "no"], { message: "Choose yes or no" }),
    maxTicketGbp: z
      .string()
      .trim()
      .optional()
      .transform((s) => (s ? Number(s.replace(/[£,\s]/g, "")) : 0))
      .refine((n) => Number.isInteger(n) && n >= 0 && n <= 10_000_000, "Enter a whole number of pounds"),
    note: VoteNote,
  })
  .refine((v) => v.interested === "no" || v.maxTicketGbp > 0, { message: "Enter the most you'd invest" });

export async function castEoi(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = EoiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const ctx = await votableDeal(ventureId, "eoi");
  if ("error" in ctx) return { error: ctx.error };
  const interested = parsed.data.interested === "yes";
  const maxTicketGbp = interested ? parsed.data.maxTicketGbp : 0;
  await db.$transaction([
    db.investmentVote.create({
      data: { ventureId, angelName: ctx.angel.name, angelId: ctx.angel.id, interested, maxTicketGbp, note: parsed.data.note, recordedById: ctx.user.id },
    }),
    db.angelEvent.create({
      data: {
        angelId: ctx.angel.id,
        kind: "expression-of-interest",
        detail: `${ctx.room.name}: ${interested ? `up to £${maxTicketGbp.toLocaleString("en-GB")}` : "not investing"}`,
        actorId: ctx.user.id,
      },
    }),
  ]);
  revalidateVote(ventureId);
  return { ok: true };
}
