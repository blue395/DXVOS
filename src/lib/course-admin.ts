import "server-only";
// The team's "Course learners" list (Angels > Course learners) and its CSV. Progress, how they
// describe themselves and the syndicate opt-in only: never their notes or quiz answers.
import { db } from "./db";
import { learnerRow } from "./course";

export async function loadCourseLearners() {
  const learners = await db.courseLearner.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      createdAt: true,
      lastActiveAt: true,
      describesAs: true,
      user: {
        select: {
          name: true,
          email: true,
          role: true,
          angelId: true,
          lastSignInAt: true,
          courseJoinRequests: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
        },
      },
      progress: { select: { lesson: true, correct: true, completedAt: true, openedAt: true } },
      consents: { where: { kind: "SYNDICATE_CONTACT" }, orderBy: { createdAt: "desc" }, take: 1, select: { given: true, createdAt: true } },
    },
  });
  return learners.map((l) =>
    learnerRow({
      userId: l.userId,
      name: l.user.name,
      email: l.user.email,
      role: l.user.role,
      angelId: l.user.angelId,
      createdAt: l.createdAt,
      lastActiveAt: l.lastActiveAt,
      lastSignInAt: l.user.lastSignInAt,
      describesAs: l.describesAs,
      progress: l.progress,
      syndicateContact: l.consents[0] ?? null,
      request: l.user.courseJoinRequests[0] ?? null,
    }),
  );
}
