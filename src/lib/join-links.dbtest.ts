// Shareable sign-up links against a throwaway database (synthetic people only; emails
// print, never send): the link can't be forged, requests need a confirmed email and a
// partner's approval, existing logins get a sign-in email, existing records stay single.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashInviteToken, newInviteToken } from "./invite-token";
import { findUsableInvite } from "@/app/join/[token]/invite";
import {
  approveJoinRequest,
  completeInstantProviderJoin,
  confirmJoinEmail,
  declineJoinRequest,
  issueJoinFormToken,
  joinLinkToken,
  loadJoinLink,
  requestToJoin,
} from "./join-links";

const stamp = Date.now();
let admin: { id: string; name: string };
const formToken = () => issueJoinFormToken(Date.now() - 10_000);
const mail = (who: string) => `${who}-${stamp}@example.test`;

async function link(data: { maxUses?: number; revoked?: boolean; instant?: boolean } = {}) {
  const l = await db.memberJoinLink.create({
    data: {
      label: `Test link ${stamp}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      maxUses: data.maxUses ?? null,
      instant: data.instant ?? false,
      revokedAt: data.revoked ? new Date() : null,
      createdById: admin.id,
    },
  });
  return { id: l.id, token: joinLinkToken(l.id) };
}

/** A request whose emailed confirm link we know (the real one is only in the email). */
async function confirmedRequest(linkId: string, name: string, email: string) {
  const { token, tokenHash } = newInviteToken();
  await db.memberJoinRequest.create({ data: { linkId, name, email, confirmTokenHash: tokenHash, confirmExpiresAt: new Date(Date.now() + 3_600_000) } });
  expect(await confirmJoinEmail(token)).toEqual({ outcome: "confirmed" });
  return db.memberJoinRequest.findFirstOrThrow({ where: { email, status: "PENDING" } });
}

beforeAll(async () => {
  process.env.SESSION_SECRET ??= "synthetic-test-secret-for-signed-links-0123456789";
  const u = await db.user.create({ data: { name: "Synthetic Partner", email: `jp-${stamp}@example.test`, passwordHash: "x", role: "ADMIN" } });
  admin = { id: u.id, name: u.name };
  // Invites need the statements and member terms approved.
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

describe("the link itself", () => {
  it("can't be forged or guessed from the id", async () => {
    const { id, token } = await link();
    expect((await loadJoinLink(token))?.state).toBe("open");
    expect(await loadJoinLink(`${id}.forged`)).toBeNull();
    expect(await loadJoinLink(id)).toBeNull();
  });

  it("stops taking requests when switched off", async () => {
    const { token } = await link({ revoked: true });
    expect(await requestToJoin(token, { name: "Sam Synthetic", email: mail("off"), formToken: formToken() }, null)).toEqual({
      error: expect.stringMatching(/switched off/),
    });
  });

  it("stops taking requests once its cap of confirmed requests is reached", async () => {
    const { id, token } = await link({ maxUses: 1 });
    await confirmedRequest(id, "First Synthetic", mail("first"));
    expect((await loadJoinLink(token))?.state).toBe("full");
    expect(await requestToJoin(token, { name: "Second Synthetic", email: mail("second"), formToken: formToken() }, null)).toEqual({
      error: expect.stringMatching(/used as many times/),
    });
  });

  it("refuses bots: an instant submission or a filled-in trap field", async () => {
    const { token } = await link();
    expect("error" in (await requestToJoin(token, { name: "Bot", email: mail("bot"), formToken: issueJoinFormToken() }, null))).toBe(true);
    expect("error" in (await requestToJoin(token, { name: "Bot", email: mail("bot2"), formToken: formToken(), trap: "x" }, null))).toBe(true);
  });
});

describe("asking to join", () => {
  it("someone new: waits for their email confirmation, then a partner, before any invite", async () => {
    const { token } = await link();
    const email = mail("newperson");
    expect(await requestToJoin(token, { name: "New Synthetic", email: email.toUpperCase(), formToken: formToken() }, "203.0.113.9")).toEqual({ ok: true });
    const r = await db.memberJoinRequest.findFirstOrThrow({ where: { email } });
    expect(r.status).toBe("UNCONFIRMED");
    expect(r.confirmTokenHash).toBeTruthy();
    expect(await db.angel.count({ where: { email } })).toBe(0); // nothing in the directory yet
  });

  it("someone with a login already: a sign-in email, nothing to approve", async () => {
    const angel = await db.angel.create({ data: { name: "Existing Login", email: mail("haslogin"), status: "MEMBER", createdById: admin.id } });
    await db.user.create({ data: { name: angel.name, email: angel.email!, passwordHash: "x", role: "ANGEL", angelId: angel.id } });
    const { token } = await link();
    expect(await requestToJoin(token, { name: "Existing Login", email: angel.email!, formToken: formToken() }, null)).toEqual({ ok: true });
    const r = await db.memberJoinRequest.findFirstOrThrow({ where: { email: angel.email! } });
    expect(r.status).toBe("HAS_LOGIN");
    expect(r.confirmTokenHash).toBeNull();
  });

  it("a confirm link works once, and not after it expires", async () => {
    const { id } = await link();
    const { token, tokenHash } = newInviteToken();
    await db.memberJoinRequest.create({
      data: { linkId: id, name: "Once Synthetic", email: mail("once"), confirmTokenHash: tokenHash, confirmExpiresAt: new Date(Date.now() + 60_000) },
    });
    expect(await confirmJoinEmail(token)).toEqual({ outcome: "confirmed" });
    expect(await confirmJoinEmail(token)).toEqual({ outcome: "invalid" });
    const late = newInviteToken();
    await db.memberJoinRequest.create({
      data: { linkId: id, name: "Late Synthetic", email: mail("late"), confirmTokenHash: late.tokenHash, confirmExpiresAt: new Date(Date.now() - 1) },
    });
    expect(await confirmJoinEmail(late.token)).toEqual({ outcome: "invalid" });
    expect(hashInviteToken(late.token)).toBe(late.tokenHash);
  });
});

describe("a partner's decision", () => {
  it("approving someone new adds them as a Prospect with a one-time invite", async () => {
    const { id } = await link();
    const r = await confirmedRequest(id, "Brand New", mail("brandnew"));
    expect(r.angelId).toBeNull();
    const out = await approveJoinRequest(r.id, admin);
    expect("error" in out).toBe(false);
    const angel = await db.angel.findFirstOrThrow({ where: { email: mail("brandnew") }, include: { invites: true } });
    expect(angel.status).toBe("PROSPECT");
    expect(angel.source).toBe(`Sign-up link: Test link ${stamp}`);
    expect(angel.invites.filter((i) => !i.revokedAt && !i.usedAt)).toHaveLength(1);
    expect((await db.memberJoinRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("APPROVED");
    expect("error" in (await approveJoinRequest(r.id, admin))).toBe(true); // can't approve twice
  });

  it("someone already in the directory (no login) keeps their one record and history", async () => {
    const existing = await db.angel.create({ data: { name: "Directory Synthetic", email: mail("directory"), status: "MEMBER", createdById: admin.id } });
    await db.angelNote.create({ data: { angelId: existing.id, body: "Met at the summer event", authorId: admin.id } });
    const { id } = await link();
    const r = await confirmedRequest(id, "Directory Person", mail("directory"));
    expect(r.angelId).toBe(existing.id);
    expect("error" in (await approveJoinRequest(r.id, admin))).toBe(false);
    expect(await db.angel.count({ where: { email: mail("directory") } })).toBe(1);
    const after = await db.angel.findUniqueOrThrow({ where: { id: existing.id }, include: { invites: true, notes: true } });
    expect(after.status).toBe("MEMBER"); // not turned into a Prospect
    expect(after.notes).toHaveLength(1);
    expect(after.invites).toHaveLength(1);
  });

  it("declining sends nothing and creates nobody", async () => {
    const { id } = await link();
    const r = await confirmedRequest(id, "Declined Synthetic", mail("declined"));
    expect(await declineJoinRequest(r.id, admin.id)).toEqual({ ok: true });
    expect(await db.angel.count({ where: { email: mail("declined") } })).toBe(0);
    expect("error" in (await approveJoinRequest(r.id, admin))).toBe(true);
  });
});

describe("instant links", () => {
  async function instantConfirm(linkId: string, name: string, email: string) {
    const { token, tokenHash } = newInviteToken();
    await db.memberJoinRequest.create({ data: { linkId, name, email, confirmTokenHash: tokenHash, confirmExpiresAt: new Date(Date.now() + 3_600_000) } });
    return confirmJoinEmail(token);
  }

  it("confirming the email goes straight to set-up: a usable invite, no partner needed", async () => {
    const { id } = await link({ instant: true, maxUses: 10 });
    const out = await instantConfirm(id, "Instant Synthetic", mail("instant"));
    expect(out.outcome).toBe("setup");
    const invite = await findUsableInvite((out as { inviteToken: string }).inviteToken);
    expect(invite?.angel.email).toBe(mail("instant"));
    const angel = await db.angel.findFirstOrThrow({ where: { email: mail("instant") } });
    expect(angel.status).toBe("PROSPECT");
    expect((await db.memberJoinRequest.findFirstOrThrow({ where: { email: mail("instant") } })).status).toBe("APPROVED");
  });

  it("someone already in the directory keeps their one record", async () => {
    const existing = await db.angel.create({ data: { name: "Instant Directory", email: mail("instantdir"), status: "MEMBER", createdById: admin.id } });
    const { id } = await link({ instant: true, maxUses: 10 });
    const out = await instantConfirm(id, "Instant Directory", mail("instantdir"));
    expect(out.outcome).toBe("setup");
    expect(await db.angel.count({ where: { email: mail("instantdir") } })).toBe(1);
    expect((await findUsableInvite((out as { inviteToken: string }).inviteToken))?.angel.id).toBe(existing.id);
  });

  it("stops at its cap: the next person can't get in", async () => {
    const { id, token } = await link({ instant: true, maxUses: 1 });
    expect((await instantConfirm(id, "First Instant", mail("capone"))).outcome).toBe("setup");
    expect((await loadJoinLink(token))?.state).toBe("full");
    expect((await instantConfirm(id, "Second Instant", mail("captwo"))).outcome).toBe("invalid");
    expect(await db.angel.count({ where: { email: mail("captwo") } })).toBe(0);
  });

  it("Google/Microsoft: refuses unverified emails, non-instant links, and team logins", async () => {
    const instant = await link({ instant: true, maxUses: 10 });
    const approve = await link();
    const id = (email: string | null, subject = `sub-${email}-${stamp}`) => ({
      provider: "GOOGLE" as const,
      subject,
      email,
      anyEmail: email,
      name: "Prov Synthetic",
      hostedDomain: null,
    });
    expect(await completeInstantProviderJoin(instant.id, id(null, `none-${stamp}`), null)).toEqual({ problem: "unverified" });
    expect(await completeInstantProviderJoin(approve.id, id(mail("prov")), null)).toEqual({ problem: "link" });
    expect(await completeInstantProviderJoin(instant.id, id(`jp-${stamp}@example.test`), null)).toEqual({ problem: "team" });
    expect(await db.angel.count({ where: { email: mail("prov") } })).toBe(0);
  });
});
