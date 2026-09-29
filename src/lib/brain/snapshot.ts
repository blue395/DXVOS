import "server-only";
// What a new DXV Brain chat is given: the Playbook in use now and the approved lessons
// (all scopes). Snapshotted onto the chat, like every other AI job.
import { db } from "@/lib/db";
import { currentPlaybook } from "@/lib/playbook/current";
import type { BrainContext } from "./prompt";

/** Approved lessons given to the Brain (newest first), to keep its instructions a sensible size. */
export const MAX_BRAIN_LESSONS = 80;

export async function brainContext(): Promise<BrainContext> {
  const [eligibility, assessment, lessons] = await Promise.all([
    currentPlaybook("ELIGIBILITY"),
    currentPlaybook("ASSESSMENT"),
    db.lesson.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      take: MAX_BRAIN_LESSONS,
      select: { title: true, body: true, scope: true },
    }),
  ]);
  return {
    eligibility: { version: eligibility.version, playbook: eligibility.content },
    assessment: { version: assessment.version, playbook: assessment.content },
    lessons,
  };
}
