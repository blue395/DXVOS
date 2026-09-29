"use server";

// Playbook actions: save the criteria as a new version (append-only), restore an old
// version, and curate lessons. Every action checks the admin itself.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LessonScope, PlaybookKind } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_ASSESSMENT, DEFAULT_ELIGIBILITY } from "@/lib/playbook/defaults";
import { AssessmentPlaybookSchema, EligibilityPlaybookSchema } from "@/lib/playbook/schema";
import type { ActionResult } from "@/lib/action-result";

function revalidatePlaybook() {
  revalidatePath("/playbook");
  revalidatePath("/", "layout"); // the nav's suggested-lessons badge
}

function firstError(err: z.ZodError) {
  const issue = err.issues[0];
  return issue ? issue.message : "Invalid input";
}

async function nextVersion(kind: PlaybookKind) {
  const latest = await db.playbookVersion.findFirst({ where: { kind }, orderBy: { version: "desc" }, select: { version: true } });
  return (latest?.version ?? 0) + 1;
}

// ── Criteria (versioned) ────────────────────────────────────────────────────

/** Save the edited criteria as the next version. The AI uses it from its next run. */
export async function savePlaybook(kind: PlaybookKind, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Add a short note on what changed and why (it's kept in the history)." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("content") ?? ""));
  } catch {
    return { error: "Couldn't read the criteria. Reload the page and try again." };
  }
  const parsed = (kind === "ELIGIBILITY" ? EligibilityPlaybookSchema : AssessmentPlaybookSchema).safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await db.playbookVersion.create({ data: { kind, version: await nextVersion(kind), content: parsed.data, note, createdById: user.id } });
  } catch {
    return { error: "Someone saved a new version at the same moment. Reload to see it, then reapply your changes." };
  }
  revalidatePlaybook();
  return { ok: true };
}

/** Make an older version current again, as a new version (history is never rewritten). */
export async function restorePlaybook(kind: PlaybookKind, version: number): Promise<ActionResult> {
  const user = await requireAdmin();
  const content =
    version === 0
      ? kind === "ELIGIBILITY"
        ? DEFAULT_ELIGIBILITY
        : DEFAULT_ASSESSMENT
      : (await db.playbookVersion.findUnique({ where: { kind_version: { kind, version } } }))?.content;
  if (!content) return { error: "That version doesn't exist." };
  try {
    await db.playbookVersion.create({
      data: { kind, version: await nextVersion(kind), content, note: `Restored version ${version}`, createdById: user.id },
    });
  } catch {
    return { error: "Someone saved a new version at the same moment. Reload and try again." };
  }
  revalidatePlaybook();
  return { ok: true };
}

// ── Lessons ─────────────────────────────────────────────────────────────────

const LessonSchema = z.object({
  title: z.string().trim().min(1, "Give the lesson a short title").max(140),
  body: z.string().trim().min(1, "Describe the lesson"),
  scope: z.enum(LessonScope),
  ventureId: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .optional(),
});

export async function addLesson(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = LessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const now = new Date();
  await db.lesson.create({
    data: { ...parsed.data, ventureId: parsed.data.ventureId ?? null, status: "APPROVED", source: "HUMAN", createdById: user.id, approvedById: user.id, approvedAt: now },
  });
  revalidatePlaybook();
  return { ok: true };
}

export async function updateLesson(lessonId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = LessonSchema.omit({ ventureId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.lesson.update({ where: { id: lessonId }, data: { ...parsed.data, updatedById: user.id } });
  revalidatePlaybook();
  return { ok: true };
}

/** Approve an AI-suggested lesson: from now on the AI steps are given it. */
export async function approveLesson(lessonId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  await db.lesson.update({ where: { id: lessonId }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), updatedById: user.id } });
  revalidatePlaybook();
  return { ok: true };
}

/** Archive (not delete): kept for the record, no longer given to the AI. */
export async function archiveLesson(lessonId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  await db.lesson.update({ where: { id: lessonId }, data: { status: "ARCHIVED", updatedById: user.id } });
  revalidatePlaybook();
  return { ok: true };
}
