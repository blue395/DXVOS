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
