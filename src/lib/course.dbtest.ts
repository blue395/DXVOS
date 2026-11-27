// Angel Foundations course against a throwaway database (synthetic people only; emails print,
// never send): sign-up, one learner's progress never reaching another, the syndicate opt-in as a
// join request, approval turning the SAME login into a member login, deletion and retention.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { findUsableInvite, createLoginFromInvite } from "@/app/join/[token]/invite";
import { approveJoinRequest } from "./join-links";
import { LESSONS } from "./course";
import {
  courseSignUp,
  deleteCourseData,
  exportCourseData,
  loadCourseAccount,
  loadCourseProgress,
  runCourseRetention,
  saveCourseProgress,
  setSyndicateContact,
} from "./course-learners";
import { loadCourseLearners } from "./course-admin";
import { newInviteToken } from "./invite-token";

const stamp = Date.now();
const mail = (who: string) => `${who}-${stamp}@example.test`;
let admin: { id: string; name: string };

async function learner(who: string) {
  await courseSignUp({ name: `Synthetic ${who}`, email: mail(who) }, null);
  const u = await db.user.findUniqueOrThrow({ where: { email: mail(who) } });
  await db.user.update({ where: { id: u.id }, data: { lastSignInAt: new Date() } }); // confirmed their email
  return { ...u, lastSignInAt: new Date() };
}

beforeAll(async () => {
  process.env.APP_URL ??= "http://localhost:3001";
  process.env.SESSION_SECRET ??= "synthetic-test-secret-for-signed-links-0123456789";
  const u = await db.user.create({ data: { name: "Synthetic Partner", email: mail("partner"), passwordHash: "x", role: "ADMIN" } });
  admin = { id: u.id, name: u.name };
  for (const kind of ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT", "MEMBER_TERMS"] as const) {
    if (!(await db.complianceText.findFirst({ where: { kind, status: "APPROVED" } }))) {
      await db.complianceText.create({
        data: {
          kind,
          version: 1,
          title: kind,
          body: "Synthetic",
          criteria: ["x"],
          status: "APPROVED",
          createdById: u.id,
          approvedById: u.id,
          approvedAt: new Date(),
        },
      });
    }
  }
});
afterAll(() => db.$disconnect());

describe("signing up", () => {
  it("makes a course-only login with the consents and their exact wording, and never a second login", async () => {
    const a = await learner("signup");
    expect(a.role).toBe("LEARNER");
    expect(a.angelId).toBeNull();
    const { consents } = await loadCourseAccount(a.id);
    expect(consents.map((c) => c.kind).sort()).toEqual(["AGE", "PRIVACY_NOTICE"]);
    expect(consents.every((c) => c.given && c.wording.length > 10 && c.version)).toBe(true);
    await courseSignUp({ name: "Someone Else", email: mail("signup").toUpperCase() }, null);
    expect(await db.user.count({ where: { email: { equals: mail("signup"), mode: "insensitive" } } })).toBe(1);
  });
});

describe("sign-up limits", () => {
  it("takes at most 5 new sign-ups a day from one connection (the answer looks the same)", async () => {
    const ip = `203.0.113.${stamp % 250}`;
    for (let i = 0; i < 7; i++) await courseSignUp({ name: `Bulk ${i}`, email: mail(`bulk${i}`) }, ip);
    expect(await db.user.count({ where: { email: { startsWith: "bulk", endsWith: `-${stamp}@example.test` } } })).toBe(5);
  });
});

describe("progress", () => {
  it("is saved per login: one learner never sees another's", async () => {
    const [a, b] = [await learner("alice"), await learner("bob")];
    const answers = { "0": LESSONS[0].quiz[0].answer };
    expect(await saveCourseProgress(a.id, { "1": { opened: true, answers, notes: {} } })).toBe(true);
    expect((await loadCourseProgress(a.id)).lessons[1].answers).toEqual(answers);
    expect((await loadCourseProgress(b.id)).lessons).toEqual({});
    // A bad lesson refuses the whole save.
    expect(await saveCourseProgress(a.id, { "1": { opened: true, answers: { "0": "F" }, notes: {} } })).toBe(false);
    expect((await loadCourseProgress(a.id)).lessons[1].answers).toEqual(answers);
  });
});

describe("contact me about joining the syndicate", () => {
  it("records each change and makes (or withdraws) a join request for partners", async () => {
    const a = await learner("optin");
    await setSyndicateContact(a, true);
    const req = await db.memberJoinRequest.findFirstOrThrow({ where: { learnerId: a.id } });
    expect(req).toMatchObject({ status: "PENDING", linkId: null, email: mail("optin") });
    await setSyndicateContact(a, false);
    expect((await db.memberJoinRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("WITHDRAWN");
    const { consents } = await loadCourseAccount(a.id);
    expect(consents.filter((c) => c.kind === "SYNDICATE_CONTACT").map((c) => c.given)).toEqual([false, true]);
  });

  it("approval invites them; accepting turns the SAME login into their member login, progress kept", async () => {
    const a = await learner("approved");
    await saveCourseProgress(a.id, { "2": { opened: true, answers: {}, notes: {} } });
    await setSyndicateContact(a, true);
    const req = await db.memberJoinRequest.findFirstOrThrow({ where: { learnerId: a.id, status: "PENDING" } });
    const out = await approveJoinRequest(req.id, admin);
    expect("error" in out).toBe(false);
    const angel = await db.angel.findFirstOrThrow({ where: { email: mail("approved") } });
    expect(angel).toMatchObject({ status: "PROSPECT", source: "Angel Foundations course" });
    // The invite they get by email (only its hash is stored, so make a fresh one the same way).
    const { token, tokenHash } = newInviteToken();
    await db.angelInvite.updateMany({ where: { angelId: angel.id, usedAt: null }, data: { revokedAt: new Date() } });
    await db.angelInvite.create({
      data: { angelId: angel.id, kind: "INVITE", tokenHash, expiresAt: new Date(Date.now() + 86_400_000), createdById: admin.id },
    });
    const made = await createLoginFromInvite((await findUsableInvite(token))!, "hash", null, "Set up their login");
    expect(made).toEqual({ userId: a.id });
    const after = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(after).toMatchObject({ role: "ANGEL", angelId: angel.id, sessionVersion: a.sessionVersion + 1 });
    expect((await db.angel.findUniqueOrThrow({ where: { id: angel.id } })).status).toBe("MEMBER");
    expect((await loadCourseProgress(a.id)).lessons[2]?.opened).toBe(true);
    // Still no deals: no investor statement signed on the platform yet.
    const { angelHasDealAccess } = await import("./portal-deals");
    expect(await angelHasDealAccess((await db.angel.findUniqueOrThrow({ where: { id: angel.id } }))!)).toBe(false);
  });
});

describe("the team's list and the learner's own data", () => {
  it("lists progress and opt-ins, never notes or answers", async () => {
    const a = await learner("listed");
    await saveCourseProgress(a.id, { "1": { opened: true, answers: { "0": "A" }, notes: {} } });
    const row = (await loadCourseLearners()).find((r) => r.userId === a.id)!;
    expect(row).toMatchObject({ kind: "Learner", confirmed: true });
    expect(JSON.stringify(row)).not.toContain('"answers"');
    const mine = await exportCourseData(a.id);
    expect(mine.you.email).toBe(mail("listed"));
    expect(mine.lessons[0].answers).toEqual({ "0": "A" });
  });

  it("deleting a course-only account removes the login and everything on it", async () => {
    const a = await learner("deleteme");
    await setSyndicateContact(a, true);
    expect(await deleteCourseData(a)).toBe("account");
    expect(await db.user.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await db.courseConsent.count({ where: { userId: a.id } })).toBe(0);
    expect(await db.memberJoinRequest.count({ where: { learnerId: a.id } })).toBe(0);
  });

  it("retention deletes sign-ups never confirmed after 7 days", async () => {
    await courseSignUp({ name: "Never Confirmed", email: mail("never") }, null);
    const u = await db.user.findUniqueOrThrow({ where: { email: mail("never") } });
    await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - 8 * 86_400_000) } });
    const out = await runCourseRetention(new Date(), false);
    expect(out.unconfirmedDeleted).toBeGreaterThanOrEqual(1);
    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
  });
});
