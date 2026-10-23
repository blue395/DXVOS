"use server";

// The member's own diversity information (docs/privacy): the consent step, changes,
// withdrawal, and deleting their account. Every action is the signed-in angel's own
// (requireAngel(); the id never comes from the form). Nothing here logs or emails values.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteSession } from "@/lib/session";
import { deleteAngelRecord } from "@/lib/angel-erasure";
import { latestCertification, nextOnboardingStep } from "@/lib/pipeline";
import { saveMyDiversity, withdrawAllMyDiversity, DiversityError } from "@/lib/diversity/store";
import type { DiversityCategory } from "@/lib/diversity/questions";
import type { ActionResult } from "@/lib/action-result";

export type DiversityResult = { error?: string; ok?: boolean; saved?: DiversityCategory[]; refused?: DiversityCategory[]; withdrawn?: DiversityCategory[] };

async function nextStepPath(angelId: string) {
  const a = await db.angel.findUniqueOrThrow({ where: { id: angelId }, include: { certifications: { select: { signedOn: true, expiresOn: true } } } });
  const step = nextOnboardingStep(a, latestCertification(a.certifications));
  return step === "done" ? "/portal" : `/portal/${step}`;
}

/** The consent screen (onboarding) and Profile > My diversity information share this. */
export async function saveDiversityAnswers(mode: "onboarding" | "profile", _prev: DiversityResult, formData: FormData): Promise<DiversityResult> {
  const { user, angel } = await requireAngel();
  const skipping = formData.get("intent") === "skip";
  let out: DiversityResult = { ok: true };
  if (!skipping) {
    try {
      const r = await saveMyDiversity(angel.id, formData, mode === "onboarding" ? "signup_screen" : "profile_edit");
      out = { ok: true, ...r };
    } catch (e) {
      if (e instanceof DiversityError) return { error: "We couldn't save your answers just now. Please try again." };
      throw e;
    }
  }
  // Seen (answered or skipped): the step isn't shown again. The event says only that.
  await db.$transaction([
    db.angel.update({ where: { id: angel.id }, data: { diversityPromptedAt: angel.diversityPromptedAt ?? new Date() } }),
    db.angelEvent.create({ data: { angelId: angel.id, kind: skipping ? "diversity-step-skipped" : "diversity-updated", actorId: user.id } }),
  ]);
  revalidatePath("/portal/profile/diversity");
  // Onboarding moves on unless an answer wasn't saved (then the member sees why first).
  if (mode === "onboarding" && (skipping || !out.refused?.length)) redirect(await nextStepPath(angel.id));
  return out;
}

/** "Remove my diversity information": deletes the answers, withdraws consent (logged in the consent history). */
export async function withdrawMyDiversity(): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  try {
    await withdrawAllMyDiversity(angel.id, "profile_edit");
  } catch (e) {
    if (e instanceof DiversityError) return { error: "We couldn't remove your answers just now. Please try again." };
    throw e;
  }
  await db.angelEvent.create({ data: { angelId: angel.id, kind: "diversity-withdrawn", actorId: user.id } });
  revalidatePath("/portal/profile/diversity");
  return { ok: true };
}

/**
 * "Delete my account and all my data": the same smart erasure the team uses (personal
 * details removed; amounts and investor-statement records kept anonymised, so deal totals
 * and DXV's legal records stand). Diversity answers are deleted. Partners can't: their
 * login is a team login (another partner revokes it on the Team page first).
 */
export async function deleteMyAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, angel } = await requireAngel();
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") return { error: 'Type "delete" to confirm.' };
  if (user.role === "ADMIN") return { error: "You're a DXV partner: your login is a team login. Ask another partner to revoke it on the Team page first." };
  const done = await deleteAngelRecord(angel.id, { id: user.id });
  if ("error" in done) return { error: done.error };
  await deleteSession();
  redirect("/login?account=deleted");
}
