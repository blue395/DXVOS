import "server-only";
// Angel Foundations course (Blue, 2026-11-27): learners, their saved progress, consents (with
// the exact wording shown), the "contact me about joining" opt-in (a join request a partner
// approves) and deleting a learner's course data. Every function works on ONE login's own data.
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { CourseConsentKind } from "@/generated/prisma/enums";
import { COURSE_CONSENTS, type DescribesAs } from "@/content/course";
import { db } from "./db";
import { hashIp } from "./client-ip";
import { checkLessonSave, LESSONS, type LessonSaveInput } from "./course";
import { newInviteToken } from "./invite-token";
import { COURSE_SOURCE, notifyPartners } from "./join-links";
import { courseSignInEmail } from "./login-email";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { canSignIn, LOGIN_LINKS_PER_HOUR, LOGIN_LINKS_PER_IP_HOUR } from "./pipeline";
import { teamRefusal } from "./team-signin";

/** A new learner's first link: long enough to find the email, still one use only. */
export const COURSE_SIGNUP_LINK_MINUTES = 60;
/** Sign-ups from one connection per day (stops one visitor filling many inboxes). */
export const COURSE_SIGNUPS_PER_IP_DAY = 5;

const consentFields = (kind: CourseConsentKind, given: boolean) => ({
  kind,
  given,
  version: COURSE_CONSENTS[kind].version,
  wording: COURSE_CONSENTS[kind].wording,
});
const consentRow = (userId: string, kind: CourseConsentKind, given: boolean) => ({ userId, ...consentFields(kind, given) });

/**
 * Someone signs up (or comes back) on /learn/join. The answer is the same whether or not we
 * know the email; what we send depends on it. New people get a LEARNER login (no password:
 * they sign in with emailed links, or Google/Microsoft once connected) and a confirm-and-start link.
 */
export async function courseSignUp(input: { name: string; email: string }, ip: string | null): Promise<void> {
  const origin = appOrigin();
  if (!origin || !mailConfigured()) throw new Error("Email isn't set up.");
  const ipHash = ip ? hashIp(ip) : null;
  const hourAgo = new Date(Date.now() - 3_600_000);
  const existing = await db.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, angelId: true, disabledAt: true, angel: { select: { archivedAt: true } } },
  });
  if (existing) {
    // Already has a DXV login (learner, member or partner): just a sign-in link.
    if (!canSignIn(existing) || teamRefusal(existing.role, "link")) return;
    const [recent, fromIp] = await Promise.all([
      db.loginLink.count({ where: { userId: existing.id, createdAt: { gt: hourAgo } } }),
      ip ? db.loginLink.count({ where: { requestedIp: ip, createdAt: { gt: hourAgo } } }) : 0,
    ]);
    if (recent >= LOGIN_LINKS_PER_HOUR || fromIp >= LOGIN_LINKS_PER_IP_HOUR) return;
    await sendCourseLink(existing, ip, false);
    return;
  }
  if (ipHash) {
    const today = await db.courseLearner.count({ where: { ipHash, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
    if (today >= COURSE_SIGNUPS_PER_IP_DAY) return;
  }
  const unusable = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: unusable,
      role: "LEARNER",
      courseLearner: {
        create: { ipHash, consents: { create: [consentFields("AGE", true), consentFields("PRIVACY_NOTICE", true)] } },
      },
    },
    select: { id: true, email: true, name: true },
  });
  await sendCourseLink(user, ip, true);
}

async function sendCourseLink(user: { id: string; email: string; name: string }, ip: string | null, isNew: boolean) {
  const origin = appOrigin()!;
  const minutes = isNew ? COURSE_SIGNUP_LINK_MINUTES : 15;
  const { token, tokenHash } = newInviteToken();
  await db.$transaction([
    db.loginLink.updateMany({ where: { userId: user.id, kind: "MAGIC", usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.loginLink.create({ data: { userId: user.id, kind: "MAGIC", tokenHash, expiresAt: new Date(Date.now() + minutes * 60_000), requestedIp: ip } }),
  ]);
  await sendMail({ to: user.email, ...courseSignInEmail({ name: user.name, link: `${origin}/login/link/${token}?next=learn`, minutes, isNew }) });
}

/** The course record for a login, made on first use (members and partners get the course automatically). */
export async function ensureCourseLearner(userId: string) {
  return db.courseLearner.upsert({ where: { userId }, create: { userId }, update: { lastActiveAt: new Date() } });
}

/** This login's saved progress, by lesson number. */
export async function loadCourseProgress(userId: string) {
  const rows = await db.courseProgress.findMany({ where: { userId } });
  const lessons: Record<number, { opened: boolean; answers: Record<string, string>; notes: Record<string, string> }> = {};
  for (const r of rows) lessons[r.lesson] = { opened: !!r.openedAt, answers: r.answers as Record<string, string>, notes: r.notes as Record<string, string> };
  return { lessons };
}

/** Save lessons the browser changed. Every lesson is checked against the lesson itself first; one bad lesson refuses the lot. */
export async function saveCourseProgress(userId: string, lessons: Record<string, LessonSaveInput>): Promise<boolean> {
  const checked = Object.entries(lessons).map(([n, input]) => ({ n: Number(n), c: checkLessonSave(Number(n), input) }));
  if (checked.some((x) => !x.c)) return false;
  await ensureCourseLearner(userId);
  const now = new Date();
  await db.$transaction(
    checked.map(({ n, c }) => {
      const data = {
        answers: c!.answers as Prisma.InputJsonValue,
        notes: c!.notes as Prisma.InputJsonValue,
        correct: c!.correct,
        completedAt: c!.complete ? now : null,
        openedAt: c!.opened ? now : null,
      };
      return db.courseProgress.upsert({
        where: { userId_lesson: { userId, lesson: n } },
        create: { userId, lesson: n, ...data },
        // Keep the first time a lesson was opened / completed.
        update: { ...data, openedAt: c!.opened ? undefined : null, completedAt: c!.complete ? undefined : null },
      });
    }),
  );
  // Keep the first opened / completed time, filling it only if it was empty.
  await db.courseProgress.updateMany({
    where: { userId, openedAt: null, OR: checked.filter((x) => x.c!.opened).map((x) => ({ lesson: x.n })) },
    data: { openedAt: now },
  });
  await db.courseProgress.updateMany({
    where: { userId, completedAt: null, OR: checked.filter((x) => x.c!.complete).map((x) => ({ lesson: x.n })) },
    data: { completedAt: now },
  });
  return true;
}

/** Where a learner stands: their description, and the latest answer for each consent. */
export async function loadCourseAccount(userId: string) {
  const [learner, consents, request] = await Promise.all([
    ensureCourseLearner(userId),
    db.courseConsent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.memberJoinRequest.findFirst({
      where: { learnerId: userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, decidedAt: true },
    }),
  ]);
  const latest = (kind: CourseConsentKind) => consents.find((c) => c.kind === kind) ?? null;
  return { learner, consents, syndicateContact: latest("SYNDICATE_CONTACT"), request };
}

/** Their own description (not a legal statement). */
export async function describeLearner(userId: string, describesAs: DescribesAs) {
  await ensureCourseLearner(userId);
  await db.courseLearner.update({ where: { userId }, data: { describesAs, describedAt: new Date() } });
}

/**
 * The separate, optional "contact me about joining the syndicate" box. Every change is a new
 * consent row with the exact wording. For course-only learners, saying yes makes a join request
 * (partners are emailed and approve or decline on Angels > Invite an angel); saying no withdraws a
 * request nobody has decided yet. Members and partners are already in, so it's only recorded.
 */
export async function setSyndicateContact(user: { id: string; name: string; email: string; role: string }, given: boolean) {
  const { syndicateContact } = await loadCourseAccount(user.id);
  if ((syndicateContact?.given ?? false) === given) return;
  await db.courseConsent.create({ data: consentRow(user.id, "SYNDICATE_CONTACT", given) });
  if (user.role !== "LEARNER") return;
  if (!given) {
    await db.memberJoinRequest.updateMany({ where: { learnerId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
    return;
  }
  const open = await db.memberJoinRequest.findFirst({ where: { learnerId: user.id, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } });
  if (open) return;
  const angel = await db.angel.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" }, erasedAt: null },
    select: { id: true, name: true, status: true },
  });
  await db.memberJoinRequest.create({
    data: {
      linkId: null,
      learnerId: user.id,
      name: user.name,
      email: user.email.toLowerCase(),
      status: "PENDING",
      confirmedAt: new Date(),
      angelId: angel?.id ?? null,
    },
  });
  await notifyPartners({
    name: user.name,
    email: user.email,
    label: COURSE_SOURCE,
    matched: angel ? `${angel.name} (${angel.status.toLowerCase()})` : null,
    course: true,
  });
}

/** Everything the course holds about this login, for "Download my course data". */
export async function exportCourseData(userId: string) {
  const [user, account, progress] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, createdAt: true, lastSignInAt: true } }),
    loadCourseAccount(userId),
    db.courseProgress.findMany({ where: { userId }, orderBy: { lesson: "asc" } }),
  ]);
  return {
    course: "Angel Investing Foundations (Diversity X Ventures)",
    exportedAt: new Date().toISOString(),
    you: { name: user.name, email: user.email, signedUp: account.learner.createdAt, lastSignIn: user.lastSignInAt, describesAs: account.learner.describesAs },
    lessons: progress.map((p) => ({
      lesson: p.lesson,
      title: LESSONS.find((l) => l.n === p.lesson)?.title,
      opened: p.openedAt,
      completed: p.completedAt,
      quizCorrect: p.correct,
      answers: p.answers,
      notes: p.notes,
    })),
    consents: account.consents.map((c) => ({ what: c.kind, given: c.given, wording: c.wording, version: c.version, at: c.createdAt })),
    joinRequest: account.request,
  };
}

/**
 * "Delete my course data". A course-only login is deleted with everything on it; a member's or
 * partner's login stays (only their course data goes: the Deal Platform has its own rules).
 */
export async function deleteCourseData(user: { id: string; role: string }) {
  if (user.role === "LEARNER") {
    await db.$transaction([
      db.memberJoinRequest.deleteMany({ where: { learnerId: user.id, status: { in: ["PENDING", "WITHDRAWN", "DECLINED"] } } }),
      db.loginLink.deleteMany({ where: { userId: user.id } }),
      db.loginIdentity.deleteMany({ where: { userId: user.id } }),
      db.user.delete({ where: { id: user.id } }), // course record, progress and consents go with it
    ]);
    return "account" as const;
  }
  await db.courseLearner.deleteMany({ where: { userId: user.id } });
  return "course" as const;
}

/** Course learners kept 24 months after they last used the course (members: their membership's own rules). */
export const COURSE_KEEP_DAYS = 730;
/** Sign-ups whose email was never confirmed. */
export const COURSE_UNCONFIRMED_DAYS = 7;

/**
 * Daily retention for course-only logins: unconfirmed sign-ups after 7 days, always; learners
 * inactive for 24 months only when RETENTION_DELETE_INACTIVE=on (counted otherwise), like members.
 */
export async function runCourseRetention(now: Date, live: boolean) {
  const DAY = 86_400_000;
  const [unconfirmed, inactive] = await Promise.all([
    db.user.findMany({
      where: { role: "LEARNER", lastSignInAt: null, createdAt: { lt: new Date(now.getTime() - COURSE_UNCONFIRMED_DAYS * DAY) } },
      select: { id: true, role: true },
    }),
    db.user.findMany({
      where: {
        role: "LEARNER",
        lastSignInAt: { not: null },
        courseLearner: { is: { lastActiveAt: { lt: new Date(now.getTime() - COURSE_KEEP_DAYS * DAY) } } },
      },
      select: { id: true, role: true },
    }),
  ]);
  for (const u of unconfirmed) await deleteCourseData(u);
  if (live) for (const u of inactive) await deleteCourseData(u);
  return { unconfirmedDeleted: unconfirmed.length, inactiveDeleted: live ? inactive.length : 0, inactiveWouldDelete: live ? 0 : inactive.length };
}
