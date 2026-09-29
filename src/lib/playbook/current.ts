import "server-only";
// The Playbook in use now (latest saved version, else version 0 = DXV's original
// documents) and the approved lessons, snapshotted onto each AI job when it's created.
import type { LessonScope, PlaybookKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { DEFAULT_ASSESSMENT, DEFAULT_ELIGIBILITY } from "./defaults";
import {
  AssessmentPlaybookSchema,
  EligibilityPlaybookSchema,
  type AiContextSnapshot,
  type AssessmentPlaybook,
  type EligibilityPlaybook,
  type LessonForAI,
} from "./schema";

type Current<T> = { version: number; content: T; note: string | null; createdAt: Date | null; createdBy: string | null };

/** How many approved lessons the AI is given (newest first), to keep prompts a sensible size. */
export const MAX_LESSONS_FOR_AI = 40;

const LESSON_SCOPES: Record<PlaybookKind, LessonScope[]> = {
  ELIGIBILITY: ["GENERAL", "ELIGIBILITY"],
  ASSESSMENT: ["GENERAL", "ASSESSMENT"],
};

export async function currentPlaybook(kind: "ELIGIBILITY"): Promise<Current<EligibilityPlaybook>>;
export async function currentPlaybook(kind: "ASSESSMENT"): Promise<Current<AssessmentPlaybook>>;
export async function currentPlaybook(kind: PlaybookKind): Promise<Current<EligibilityPlaybook | AssessmentPlaybook>> {
  const latest = await db.playbookVersion.findFirst({
    where: { kind },
    orderBy: { version: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  const fallback = kind === "ELIGIBILITY" ? DEFAULT_ELIGIBILITY : DEFAULT_ASSESSMENT;
  if (!latest) return { version: 0, content: fallback, note: "DXV's original document", createdAt: null, createdBy: null };
  const parsed = (kind === "ELIGIBILITY" ? EligibilityPlaybookSchema : AssessmentPlaybookSchema).safeParse(latest.content);
  if (!parsed.success) {
    console.error(`Playbook ${kind} v${latest.version} is invalid; using the default`, parsed.error);
    return { version: 0, content: fallback, note: "DXV's original document", createdAt: null, createdBy: null };
  }
  return { version: latest.version, content: parsed.data, note: latest.note, createdAt: latest.createdAt, createdBy: latest.createdBy.name };
}

export async function approvedLessonsFor(kind: PlaybookKind): Promise<LessonForAI[]> {
  return db.lesson.findMany({
    where: { status: "APPROVED", scope: { in: LESSON_SCOPES[kind] } },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    take: MAX_LESSONS_FOR_AI,
    select: { title: true, body: true },
  });
}

/** What an AI job will be given: snapshot it onto the job so the run is reproducible and explainable. */
export async function aiContextFor(kind: "ELIGIBILITY"): Promise<AiContextSnapshot<EligibilityPlaybook>>;
export async function aiContextFor(kind: "ASSESSMENT"): Promise<AiContextSnapshot<AssessmentPlaybook>>;
export async function aiContextFor(kind: PlaybookKind): Promise<AiContextSnapshot> {
  const [playbook, lessons] = await Promise.all([
    kind === "ELIGIBILITY" ? currentPlaybook("ELIGIBILITY") : currentPlaybook("ASSESSMENT"),
    approvedLessonsFor(kind),
  ]);
  return { playbookVersion: playbook.version, playbook: playbook.content, lessons };
}
