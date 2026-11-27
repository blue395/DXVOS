// The Angel Foundations course (/learn): lessons, the page build, and the rules for saving
// progress. Pure (no database): tested in course.test.ts.
import lessonsJson from "@/content/course/lessons.json";
import { z } from "zod";

export type CourseLesson = {
  n: number;
  short: string;
  title: string;
  blocks: { t: string; text?: string; html?: string; rows?: string[][]; notes?: boolean }[];
  quiz: { q: string; options: { k: string; text: string }[]; answer: string; explanation: string }[];
};
export const LESSONS = lessonsJson as CourseLesson[];
export const LESSON_COUNT = LESSONS.length;
export const QUESTION_COUNT = LESSONS.reduce((n, l) => n + l.quiz.length, 0);

const NOTE_MAX = 4000;
const NOTES_PER_LESSON = 40;

const LessonSave = z.object({
  opened: z.boolean(),
  answers: z.record(z.string().regex(/^\d{1,2}$/), z.string().regex(/^[A-F]$/)),
  notes: z.record(z.string().regex(/^note-\d-\d{1,3}-\d{1,3}$/), z.string().max(NOTE_MAX)),
});
export const ProgressSave = z.object({ lessons: z.record(z.string().regex(/^\d$/), LessonSave) });
export type LessonSaveInput = z.infer<typeof LessonSave>;

/**
 * One lesson as saved, checked against the lesson itself: real questions and options only,
 * notes only for this lesson's note tables, and the score worked out here (never trusted from
 * the browser). Null when it doesn't fit the lesson.
 */
export function checkLessonSave(n: number, input: LessonSaveInput) {
  const lesson = LESSONS.find((l) => l.n === n);
  if (!lesson) return null;
  const answers: Record<string, string> = {};
  for (const [i, k] of Object.entries(input.answers)) {
    const q = lesson.quiz[Number(i)];
    if (!q || !q.options.some((o) => o.k === k)) return null;
    answers[i] = k;
  }
  const noteKeys = Object.keys(input.notes);
  if (noteKeys.length > NOTES_PER_LESSON) return null;
  const notes: Record<string, string> = {};
  for (const key of noteKeys) {
    const [, ln, bi, ri] = key.split("-").map(Number) as [unknown, number, number, number];
    const block = lesson.blocks[bi];
    if (ln !== n || !block || block.t !== "table" || !block.notes || !block.rows || ri < 0 || ri >= block.rows.length - 1) return null;
    if (input.notes[key].trim()) notes[key] = input.notes[key];
  }
  const correct = lesson.quiz.filter((q, i) => answers[String(i)] === q.answer).length;
  const complete = Object.keys(answers).length >= lesson.quiz.length;
  return { opened: input.opened || Object.keys(answers).length > 0, answers, notes, correct, complete };
}

/** A learner's course totals, for the team's list and the CSV. */
export function courseSummary(rows: { lesson: number; correct: number; completedAt: Date | null; openedAt: Date | null }[]) {
  const done = rows.filter((r) => r.completedAt);
  return {
    lessonsStarted: rows.filter((r) => r.openedAt).length,
    lessonsComplete: done.length,
    correct: done.reduce((n, r) => n + r.correct, 0),
    answeredOf: done.reduce((n, r) => n + (LESSONS.find((l) => l.n === r.lesson)?.quiz.length ?? 0), 0),
  };
}

/** JSON safe to put inside a <script> element (no "</script>", no line separators). */
export const scriptJson = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/** The course page, built the same way as DXV's single-file course, plus the signed-in account. */
export function buildCoursePage(template: string, logo: string, account: { id: string; name: string; portal: string | null }) {
  const data = JSON.stringify(LESSONS).replace(/<\//g, "<\\/");
  // Function replacers: a "$" in the content is never read as a replacement pattern.
  return template
    .replace("__DATA__", () => data)
    .replace("__ACCOUNT__", () => scriptJson(account))
    .replaceAll("__LOGO__", () => logo);
}

export type LearnerKind = "Learner" | "Member" | "Partner";

/** One row of the team's "Course learners" list (and the CSV). Pure: tested. */
export function learnerRow(r: {
  userId: string;
  name: string;
  email: string;
  role: string;
  angelId: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  lastSignInAt: Date | null;
  describesAs: string | null;
  progress: { lesson: number; correct: number; completedAt: Date | null; openedAt: Date | null }[];
  syndicateContact: { given: boolean; createdAt: Date } | null;
  request: { status: string; createdAt: Date } | null;
}) {
  const kind: LearnerKind = r.role === "ADMIN" ? "Partner" : r.role === "ANGEL" ? "Member" : "Learner";
  return {
    ...r,
    kind,
    confirmed: !!r.lastSignInAt,
    summary: courseSummary(r.progress),
    wantsContact: r.syndicateContact?.given ?? false,
  };
}
