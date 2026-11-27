"use server";

// The Angel Foundations course: a signed-in login's own answers only (the id is from the
// session, never the form).

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireCourseUser } from "@/lib/auth";
import { DESCRIBES_AS } from "@/content/course";
import { deleteCourseData, describeLearner, setSyndicateContact } from "@/lib/course-learners";
import { deleteSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

const Describe = z.enum(DESCRIBES_AS.map((d) => d.key) as [string, ...string[]]);

/** After sign-up: how they describe themselves, and (separately, optional) the syndicate opt-in. */
export async function saveWelcome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCourseUser();
  const d = Describe.safeParse(formData.get("describesAs"));
  if (!d.success) return { error: "Choose the option that best describes you." };
  await describeLearner(user.id, d.data as (typeof DESCRIBES_AS)[number]["key"]);
  if (formData.get("syndicateContact") === "on") await setSyndicateContact(user, true);
  return { ok: true }; // the form then opens the course with a full page load
}

export async function changeDescription(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCourseUser();
  const d = Describe.safeParse(formData.get("describesAs"));
  if (!d.success) return { error: "Choose the option that best describes you." };
  await describeLearner(user.id, d.data as (typeof DESCRIBES_AS)[number]["key"]);
  revalidatePath("/learn/account");
  return { ok: true };
}

export async function changeSyndicateContact(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCourseUser();
  await setSyndicateContact(user, formData.get("syndicateContact") === "on");
  revalidatePath("/learn/account");
  return { ok: true };
}

/** "Delete my course data": typed confirmation. A course-only login is deleted (and signed out). */
export async function deleteMyCourseData(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCourseUser();
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "DELETE"
  )
    return { error: "Type DELETE to confirm." };
  const what = await deleteCourseData(user);
  if (what === "account") {
    await deleteSession();
    redirect("/learn/join?deleted=1");
  }
  redirect("/learn/account?deleted=1");
}

export async function signOutOfCourse(): Promise<ActionResult> {
  await deleteSession();
  redirect("/learn/join");
}
