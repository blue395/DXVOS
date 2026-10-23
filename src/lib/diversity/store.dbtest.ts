// Diversity data access, against a real (throwaway) database: synthetic people only.
// Every cross-member read or write must fail, and no answer may exist without consent.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  eraseDiversityForAngel,
  loadMyDiversity,
  rawDiversityCounts,
  runDiversityRetention,
  saveMyDiversity,
  viewMemberDiversity,
  withdrawAllMyDiversity,
} from "./store";

const form = (pairs: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of pairs) f.append(k, v);
  return f;
};

/** Run raw SQL as a role, like the app does (one transaction). */
async function as<T>(role: string, angelId: string | null, fn: (q: typeof db) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
    if (angelId) await tx.$executeRaw`SELECT set_config('dxv.angel_id', ${angelId}, true)`;
    return fn(tx as unknown as typeof db);
  });
}
const failsAs = (role: string, angelId: string | null, sql: string) => expect(as(role, angelId, (q) => q.$executeRawUnsafe(sql))).rejects.toThrow();

let alice: string, bob: string, viewer: string, bobSubject: string;

beforeAll(async () => {
  const stamp = Date.now();
  viewer = (await db.user.create({ data: { name: "Synthetic Partner", email: `partner-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } })).id;
  alice = (await db.angel.create({ data: { name: "Synthetic Alice", email: `alice-${stamp}@example.test`, createdById: viewer } })).id;
  bob = (await db.angel.create({ data: { name: "Synthetic Bob", email: `bob-${stamp}@example.test`, createdById: viewer } })).id;
  await saveMyDiversity(alice, form([["q_gender", "Woman"], ["consent_gender_background", "on"], ["q_disability", "Yes, neurodivergent"], ["consent_health", "on"]]), "signup_screen");
  await saveMyDiversity(bob, form([["q_gender", "Man"], ["consent_gender_background", "on"]]), "signup_screen");
  bobSubject = (await as("dxv_diversity_system", null, (q) => q.diversitySubject.findUniqueOrThrow({ where: { angelId: bob } }))).id;
});

afterAll(() => db.$disconnect());

describe("members see and change only their own diversity rows", () => {
  it("loads only the signed-in member's answers", async () => {
    const a = await loadMyDiversity(alice);
    expect(a.answers.map((x) => x.value).sort()).toEqual(["Woman", "Yes, neurodivergent"]);
    expect((await loadMyDiversity(bob)).answers.map((x) => x.value)).toEqual(["Man"]);
  });

  it("cannot read another member's rows, even by asking for them directly", async () => {
    const seen = await as("dxv_member", alice, (q) => q.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "DiversityAnswer" WHERE "subjectId" = '${bobSubject}'`));
    expect(Number(seen[0].n)).toBe(0);
    const all = await as("dxv_member", alice, (q) => q.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "DiversityAnswer"`));
    expect(Number(all[0].n)).toBe(2);
    for (const t of ["DiversityConsent", "DiversityConsentLog", "DiversityPending"]) {
      const r = await as("dxv_member", alice, (q) => q.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t}" WHERE "subjectId" = '${bobSubject}'`));
      expect(Number(r[0].n), t).toBe(0);
    }
  });

  it("cannot write, change or delete another member's rows", async () => {
    await failsAs("dxv_member", alice, `INSERT INTO "DiversityAnswer" ("subjectId", category, question, value) VALUES ('${bobSubject}', 'gender_background', 'gender', 'Woman')`);
    await failsAs("dxv_member", alice, `INSERT INTO "DiversityConsent" ("subjectId", category, status, "wordingVersion", "givenAt", method, "updatedAt") VALUES ('${bobSubject}', 'religion', 'given', 'x', now(), 'profile_edit', now())`);
    await failsAs("dxv_member", alice, `INSERT INTO "DiversitySubject" ("angelId") VALUES ('${bob}')`);
    const updated = await as("dxv_member", alice, (q) => q.$executeRawUnsafe(`UPDATE "DiversityAnswer" SET value = 'Woman' WHERE "subjectId" = '${bobSubject}'`));
    const deleted = await as("dxv_member", alice, (q) => q.$executeRawUnsafe(`DELETE FROM "DiversityAnswer" WHERE "subjectId" = '${bobSubject}'`));
    expect([updated, deleted]).toEqual([0, 0]);
    expect((await loadMyDiversity(bob)).answers.map((x) => x.value)).toEqual(["Man"]);
  });

  it("with no member set, sees nothing", async () => {
    const r = await as("dxv_member", null, (q) => q.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "DiversityAnswer"`));
    expect(Number(r[0].n)).toBe(0);
  });

  it("the member role can't touch anything else", async () => {
    await failsAs("dxv_member", alice, `SELECT * FROM "Angel"`);
    await failsAs("dxv_member", alice, `SELECT * FROM "DiversityAccessLog"`);
  });

  it("the app's own database role sees nothing in the diversity tables", async () => {
    const r = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "DiversityAnswer"`);
    expect(Number(r[0].n)).toBe(0);
  });
});

describe("no answer without consent", () => {
  it("does not save an answer whose consent box wasn't ticked", async () => {
    const out = await saveMyDiversity(alice, form([["q_gender", "Woman"], ["q_disability", "Yes, neurodivergent"], ["q_religion", "Buddhist"]]), "profile_edit");
    expect(out.refused).toEqual(["religion"]);
    expect((await loadMyDiversity(alice)).answers.some((a) => a.value === "Buddhist")).toBe(false);
  });

  it("the database itself refuses an answer with no given consent", async () => {
    const aliceSubject = (await as("dxv_diversity_system", null, (q) => q.diversitySubject.findUniqueOrThrow({ where: { angelId: alice } }))).id;
    await failsAs("dxv_member", alice, `INSERT INTO "DiversityAnswer" ("subjectId", category, question, value) VALUES ('${aliceSubject}', 'religion', 'religion', 'Buddhist')`);
    await failsAs("dxv_diversity_system", null, `INSERT INTO "DiversityAnswer" ("subjectId", category, question, value) VALUES ('${aliceSubject}', 'ethnicity', 'ethnic_group', 'Irish')`);
  });

  it("changing an answer needs consent again; clearing it withdraws consent and deletes it", async () => {
    const refused = await saveMyDiversity(alice, form([["q_gender", "Non-binary"], ["q_disability", "Yes, neurodivergent"], ["consent_health", "on"]]), "profile_edit");
    expect(refused.refused).toEqual(["gender_background"]);
    expect((await loadMyDiversity(alice)).answers.find((a) => a.question === "gender")?.value).toBe("Woman");
    const cleared = await saveMyDiversity(alice, form([["q_gender", "Woman"]]), "profile_edit");
    expect(cleared.withdrawn).toEqual(["health"]);
    const d = await loadMyDiversity(alice);
    expect(d.answers.some((a) => a.category === "health")).toBe(false);
    expect(d.consents.find((c) => c.category === "health")?.status).toBe("withdrawn");
    expect(d.history.some((h) => h.category === "health" && h.action === "withdrawn")).toBe(true);
  });

  it("withdrawing everything deletes every answer and keeps the consent records", async () => {
    await withdrawAllMyDiversity(alice);
    const d = await loadMyDiversity(alice);
    expect(d.answers).toEqual([]);
    expect(d.consents.every((c) => c.status === "withdrawn")).toBe(true);
  });
});

describe("the admin role", () => {
  it("can't read the tables directly", async () => {
    await failsAs("dxv_diversity_admin", null, `SELECT * FROM "DiversityAnswer"`);
    await failsAs("dxv_diversity_admin", null, `SELECT * FROM "DiversityConsent"`);
  });

  it("gets counts only through the aggregate function", async () => {
    const counts = await rawDiversityCounts();
    expect(counts.find((c) => c.question === "gender" && c.value === "Man")?.n).toBe(1);
    expect(counts.every((c) => typeof c.n === "number")).toBe(true);
  });

  it("can view one member's answers only with a reason, and every view is logged", async () => {
    await expect(viewMemberDiversity(bob, viewer, "")).rejects.toThrow();
    const rows = await viewMemberDiversity(bob, viewer, "Member asked us to check their answers");
    expect(rows.map((r) => r.value)).toEqual(["Man"]);
    const logged = await as("dxv_diversity_system", null, (q) => q.diversityAccessLog.count({ where: { subjectId: bobSubject, viewerId: viewer } }));
    expect(logged).toBe(1);
  });
});

describe("retention and erasure", () => {
  it("deletes carried-over answers once they expire, and only those", async () => {
    await as("dxv_diversity_system", null, (q) =>
      q.diversityPending.createMany({ data: [
        { subjectId: bobSubject, category: "religion", question: "religion", value: "Sikh", expiresAt: new Date(Date.now() - 1000) },
        { subjectId: bobSubject, category: "ethnicity", question: "ethnic_group", value: "Irish", expiresAt: new Date(Date.now() + 86_400_000) },
      ] }),
    );
    expect((await loadMyDiversity(alice)).pending).toEqual([]); // never visible to another member
    const out = await runDiversityRetention();
    expect(out.pendingDeleted).toBe(1);
    expect((await loadMyDiversity(bob)).pending.map((p) => p.value)).toEqual(["Irish"]);
  });

  it("removes a member's answers when they leave (archived)", async () => {
    await db.angel.update({ where: { id: bob }, data: { archivedAt: new Date() } });
    await runDiversityRetention();
    expect((await loadMyDiversity(bob)).answers).toEqual([]);
  });

  it("account erasure deletes answers but keeps the consent record", async () => {
    await db.angel.update({ where: { id: bob }, data: { archivedAt: null } });
    await saveMyDiversity(bob, form([["q_gender", "Man"], ["consent_gender_background", "on"]]), "profile_edit");
    await eraseDiversityForAngel(bob, "profile_edit");
    const d = await loadMyDiversity(bob);
    expect(d.answers).toEqual([]);
    expect(d.pending).toEqual([]);
    expect(d.consents.find((c) => c.category === "gender_background")?.status).toBe("withdrawn");
  });
});
