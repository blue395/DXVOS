import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COURSE_LOGO, COURSE_TEMPLATE } from "@/content/course/page.generated";
import * as copy from "@/content/course";
import { buildCoursePage, checkLessonSave, courseSummary, LESSONS, learnerRow, QUESTION_COUNT, scriptJson } from "./course";

const dir = new URL("../content/course/", import.meta.url);

describe("the Angel Foundations course content", () => {
  it("is DXV's six lessons and 30 questions, unchanged", () => {
    expect(LESSONS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(QUESTION_COUNT).toBe(30);
    expect(JSON.parse(readFileSync(new URL("lessons.json", dir), "utf8"))).toEqual(LESSONS);
  });

  it("serves the page from the current template and logo (run scripts/build-course-page.mjs after editing them)", () => {
    expect(COURSE_TEMPLATE).toBe(readFileSync(new URL("template.html", dir), "utf8"));
    expect(COURSE_LOGO).toBe(readFileSync(new URL("logo.txt", dir), "utf8").trim());
  });

  it("builds the page with every lesson inlined, the disclaimer kept, and the account escaped", () => {
    const html = buildCoursePage(COURSE_TEMPLATE, COURSE_LOGO, { id: "u1", name: "Sam </script><script>alert(1)</script>", ribbon: false });
    expect(html).not.toMatch(/__DATA__|__LOGO__|__ACCOUNT__/);
    for (const l of LESSONS) expect(html).toContain(JSON.stringify(l.title).slice(1, -1).replace(/<\//g, "<\\/"));
    expect(html).toContain("It is not investment, tax or legal advice");
    expect(html).not.toContain("</script><script>alert(1)");
    expect(scriptJson({ a: "</script>\u2028" })).toBe('{"a":"\\u003c/script>\\u2028"}');
  });

  it("our own wording uses no em dashes, arrows or emoji", () => {
    const text = JSON.stringify(copy) + JSON.stringify(copy.coursePrivacyNotice("x@example.test", "DXV"));
    expect(text).not.toMatch(/[\u2014\u2190-\u21ff\u{1F300}-\u{1FAFF}]/u);
  });
});

describe("saving progress", () => {
  const lesson1 = LESSONS[0];
  const notesLesson = LESSONS.find((l) => l.blocks.some((b) => b.t === "table" && b.notes))!;
  const noteBlock = notesLesson.blocks.findIndex((b) => b.t === "table" && b.notes);

  it("scores answers against the lesson, never the browser", () => {
    const answers = Object.fromEntries(lesson1.quiz.map((q, i) => [String(i), q.answer]));
    const c = checkLessonSave(1, { opened: true, answers, notes: {} });
    expect(c).toMatchObject({ correct: lesson1.quiz.length, complete: true });
    const half = checkLessonSave(1, { opened: true, answers: { "0": lesson1.quiz[0].answer === "A" ? "B" : "A" }, notes: {} });
    expect(half).toMatchObject({ correct: 0, complete: false });
  });

  it("refuses questions or options the lesson doesn't have", () => {
    expect(checkLessonSave(1, { opened: true, answers: { "9": "A" }, notes: {} })).toBeNull();
    expect(checkLessonSave(1, { opened: true, answers: { "0": "F" }, notes: {} })).toBeNull();
    expect(checkLessonSave(7, { opened: true, answers: {}, notes: {} })).toBeNull();
  });

  it("keeps notes only for the lesson's own note tables", () => {
    const key = `note-${notesLesson.n}-${noteBlock}-0`;
    expect(checkLessonSave(notesLesson.n, { opened: true, answers: {}, notes: { [key]: "My thesis" } })?.notes).toEqual({ [key]: "My thesis" });
    expect(checkLessonSave(notesLesson.n, { opened: true, answers: {}, notes: { [`note-${notesLesson.n}-0-0`]: "x" } })).toBeNull();
    expect(checkLessonSave(1, { opened: true, answers: {}, notes: { [key]: "x" } })).toBeNull();
  });
});

describe("the team's learner list", () => {
  it("adds up completed lessons and says who is a learner, member or partner", () => {
    const done = new Date();
    expect(
      courseSummary([
        { lesson: 1, correct: 4, completedAt: done, openedAt: done },
        { lesson: 2, correct: 0, completedAt: null, openedAt: done },
      ]),
    ).toEqual({ lessonsStarted: 2, lessonsComplete: 1, correct: 4, answeredOf: 5 });
    const base = {
      userId: "u",
      name: "n",
      email: "e",
      angelId: null,
      createdAt: done,
      lastActiveAt: done,
      lastSignInAt: null,
      describesAs: null,
      progress: [],
      syndicateContact: null,
      request: null,
    };
    expect(learnerRow({ ...base, role: "LEARNER" })).toMatchObject({ kind: "Learner", confirmed: false, wantsContact: false });
    expect(learnerRow({ ...base, role: "ANGEL" }).kind).toBe("Member");
    expect(learnerRow({ ...base, role: "ADMIN", syndicateContact: { given: true, createdAt: done } })).toMatchObject({ kind: "Partner", wantsContact: true });
  });
});

describe("lessons as screens", () => {
  // The screen-splitting code in the course page (template.html), run against every lesson.
  const src = COURSE_TEMPLATE.slice(COURSE_TEMPLATE.indexOf("const TARGET ="), COURSE_TEMPLATE.indexOf("function renderBlock"));
  const plan = new Function("LESSONS", `${src}; return { screensFor, wc };`)(LESSONS) as {
    screensFor: (l: unknown) => { screens: { kind: string; blocks?: { bi: number; b: unknown }[] }[] };
    wc: (b: unknown) => number;
  };

  it("shows every part of every lesson exactly once, in order, in short screens", () => {
    for (const l of LESSONS) {
      const { screens } = plan.screensFor(l);
      const content = screens.filter((s) => s.kind === "content");
      const shown = content.flatMap((s) => s.blocks!.map((x) => x.bi));
      const expected = l.blocks.flatMap((b, i) => (b.t === "h1" || b.t === "h2" ? [] : [i]));
      expect(shown).toEqual(expected);
      for (const s of content) expect(s.blocks!.reduce((t, x) => t + plan.wc(x.b), 0)).toBeLessThanOrEqual(260);
      expect(screens[0].kind).toBe("title");
      expect(screens.filter((s) => s.kind === "quiz")).toHaveLength(l.quiz.length);
      expect(screens.at(-1)!.kind).toBe("score");
    }
  });
});
