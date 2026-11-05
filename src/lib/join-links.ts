import "server-only";
// Shareable sign-up links (Blue, 2026-11-05; approve first). Partners share one link (e.g. in
// the members' WhatsApp group). Anyone with it asks to join with their name and email; they
// confirm the email; a partner approves; only then do they get the normal one-time invite
// (onboarding, member terms, investor statement), so who sees deal material stays the team's
// call even if the link travels.
//
// Existing records stay single: an email that already has a DXV login gets a sign-in email
// instead (nothing to approve); an email already in the directory without a login is linked
// to that record when approved, so its history is kept.
//
// The link is the link's id plus an HMAC of it: nothing in the database can be turned back
// into a working link, and the team can copy it again at any time.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { complianceReady, inviteBlockReason } from "./compliance";
import { emailAndLog, issueAngelLink, loginClash } from "./angel-invites";
import { hashIp } from "./client-ip";
import { formTimingOk } from "./founder-intake";
import { hashInviteToken, isInviteTokenShape, newInviteToken } from "./invite-token";
import { joinAlreadyMemberEmail, joinConfirmEmail, joinRequestPartnerEmail } from "./login-email";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { JOIN_CONFIRM_HOURS, joinLinkState, joinRequestLimitError, maskEmail, type JoinLinkState } from "./pipeline";
import type { EmailOutcome } from "./send-link";

const HOUR = 3_600_000;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return s;
};
const mac = (purpose: string, value: string) => createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url");

/** The shareable link's secret part: `<id>.<hmac>`. */
export const joinLinkToken = (linkId: string) => `${linkId}.${mac("member-join-link", linkId)}`;

/** The link id a token names, if the token is genuine. */
export function joinLinkIdFrom(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[a-z0-9]{10,40}$/.test(id)) return null;
  const expected = mac("member-join-link", id);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}

/** A signed "form shown at" stamp (bots submit instantly). */
export const issueJoinFormToken = (now = Date.now()) => `${now}.${mac("join-form", String(now))}`;
function joinFormTime(token: string): number | null {
  const [t, sig] = token.split(".");
  if (!t || !sig) return null;
  const expected = mac("join-form", t);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return Number(t);
}

/** Requests that count towards a link's cap: the email was confirmed. */
const COUNTED = ["PENDING", "APPROVED", "DECLINED"] as const;

/** The link a token opens, and whether it's taking requests. */
export async function loadJoinLink(token: string): Promise<{ id: string; label: string; state: JoinLinkState } | null> {
  const id = joinLinkIdFrom(token);
  if (!id) return null;
  const link = await db.memberJoinLink.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      expiresAt: true,
      maxUses: true,
      revokedAt: true,
      _count: { select: { requests: { where: { status: { in: [...COUNTED] } } } } },
    },
  });
  if (!link) return null;
  return { id: link.id, label: link.label, state: joinLinkState(link, link._count.requests) };
}

export const LINK_STATE_MESSAGE: Record<Exclude<JoinLinkState, "open">, string> = {
  "switched-off": "This sign-up link has been switched off. Ask the DXV team for a new one.",
  expired: "This sign-up link has expired. Ask the DXV team for a new one.",
  full: "This sign-up link has been used as many times as it can be. Ask the DXV team for a new one.",
};

const JoinSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Add your name")
    .max(120)
    .refine((s) => !/https?:|www\.|\/\/|[<>[\]{}]/i.test(s), "Add just your name here"),
  email: z.string().trim().toLowerCase().pipe(z.email("That email doesn't look right")),
});

/**
 * Someone asks to join through a shareable link. The answer is the same whether or not we
 * know the email (no fishing for who's a member); what we send depends on it.
 */
export async function requestToJoin(
  token: string,
  input: { name?: unknown; email?: unknown; formToken?: unknown; trap?: unknown },
  ip: string | null,
): Promise<{ ok: true } | { error: string }> {
  const link = await loadJoinLink(token);
  if (!link) return { error: "This sign-up link doesn't work. Ask the DXV team for a new one." };
  if (link.state !== "open") return { error: LINK_STATE_MESSAGE[link.state] };
  const shownAt = joinFormTime(String(input.formToken ?? ""));
  if (input.trap || shownAt === null || !formTimingOk(shownAt, Date.now())) return { error: "Please wait a moment and try again." };
  const parsed = JoinSchema.safeParse({ name: input.name, email: input.email });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, email } = parsed.data;
  if (!mailConfigured() || !appOrigin()) return { error: "Sign-up isn't available just now. Please email angels@diversityx.vc." };

  const now = Date.now();
  const ipHash = ip ? hashIp(ip) : null;
  const [fromIpLastHour, fromEmailLastDay, viaLinkLastDay, user, angel, open] = await Promise.all([
    ipHash ? db.memberJoinRequest.count({ where: { ipHash, createdAt: { gte: new Date(now - HOUR) } } }) : 0,
    db.memberJoinRequest.count({ where: { email, createdAt: { gte: new Date(now - 24 * HOUR) } } }),
    db.memberJoinRequest.count({ where: { linkId: link.id, createdAt: { gte: new Date(now - 24 * HOUR) } } }),
    db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    db.angel.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, erasedAt: null },
      select: { id: true, user: { select: { id: true, email: true } } },
    }),
    db.memberJoinRequest.findFirst({ where: { email, status: "PENDING" }, select: { id: true } }),
  ]);
  const limited = joinRequestLimitError({ fromIpLastHour, fromEmailLastDay, viaLinkLastDay });
  if (limited) return { error: limited };

  const origin = appOrigin()!;
  // Already has a login: send a sign-in email, nothing for partners to approve.
  if (user || angel?.user) {
    await db.memberJoinRequest.create({ data: { linkId: link.id, name, email, status: "HAS_LOGIN", ipHash, angelId: angel?.id ?? null } });
    // Their directory record's login may use a different email (e.g. a partner's work address):
    // say so, partly hidden, so they don't try to sign in with this one. Sent only to this address.
    const loginEmail = !user && angel?.user && angel.user.email.toLowerCase() !== email ? maskEmail(angel.user.email) : null;
    await sendMail({ to: email, ...joinAlreadyMemberEmail({ name, signInUrl: `${origin}/login`, loginEmailHint: loginEmail }) }).catch(() =>
      console.error("Join email failed"),
    );
    return { ok: true };
  }
  // Already waiting for a partner: nothing new to send.
  if (open) return { ok: true };

  const { token: confirmToken, tokenHash } = newInviteToken();
  await db.$transaction([
    // An earlier unconfirmed request for this email is replaced (its confirm link stops working).
    db.memberJoinRequest.deleteMany({ where: { email, status: "UNCONFIRMED" } }),
    db.memberJoinRequest.create({
      data: { linkId: link.id, name, email, ipHash, confirmTokenHash: tokenHash, confirmExpiresAt: new Date(now + JOIN_CONFIRM_HOURS * HOUR) },
    }),
  ]);
  await sendMail({ to: email, ...joinConfirmEmail({ name, link: `${origin}/join/open/confirm/${confirmToken}`, hours: JOIN_CONFIRM_HOURS }) }).catch(() =>
    console.error("Join email failed"),
  );
  return { ok: true };
}

export type ConfirmOutcome = "confirmed" | "invalid";

/** They pressed "Confirm my email": the request goes to the partners (and matches an existing record). */
export async function confirmJoinEmail(token: string): Promise<ConfirmOutcome> {
  if (!isInviteTokenShape(token)) return "invalid";
  const req = await db.memberJoinRequest.findUnique({ where: { confirmTokenHash: hashInviteToken(token) }, include: { link: true } });
  if (!req || req.status !== "UNCONFIRMED" || !req.confirmExpiresAt || req.confirmExpiresAt < new Date()) return "invalid";
  const used = await db.memberJoinRequest.count({ where: { linkId: req.linkId, status: { in: [...COUNTED] } } });
  if (joinLinkState(req.link, used) !== "open") return "invalid";
  const angel = await db.angel.findFirst({
    where: { email: { equals: req.email, mode: "insensitive" }, erasedAt: null },
    select: { id: true, name: true, status: true },
  });
  // Claimed once: two clicks (or an email scanner and a person) can't both confirm.
  const claimed = await db.memberJoinRequest.updateMany({
    where: { id: req.id, status: "UNCONFIRMED" },
    data: { status: "PENDING", confirmedAt: new Date(), confirmTokenHash: null, angelId: angel?.id ?? null },
  });
  if (claimed.count !== 1) return "invalid";
  await notifyPartners({ name: req.name, email: req.email, label: req.link.label, matched: angel ? `${angel.name} (${angel.status.toLowerCase()})` : null });
  return "confirmed";
}

async function notifyPartners(r: { name: string; email: string; label: string; matched: string | null }) {
  const origin = appOrigin();
  if (!origin || !mailConfigured()) return;
  const partners = await db.user.findMany({ where: { role: "ADMIN", disabledAt: null }, select: { email: true, name: true } });
  await Promise.all(
    partners.map((p) =>
      sendMail({ to: p.email, ...joinRequestPartnerEmail({ partnerName: p.name, ...r, reviewUrl: `${origin}/angels/invite#join-requests` }) }).catch(() =>
        console.error("Join request notification failed"),
      ),
    ),
  );
}

export type ApproveResult = { error: string } | ({ ok: true; angelId: string; link: string } & EmailOutcome);

/**
 * A partner approves a join request: the matching directory record (no login yet), or a new
 * Prospect, gets the normal one-time invite, emailed like any other.
 */
export async function approveJoinRequest(requestId: string, admin: { id: string; name: string }): Promise<ApproveResult> {
  const [req, ready] = await Promise.all([
    db.memberJoinRequest.findUnique({ where: { id: requestId }, include: { link: { select: { label: true } } } }),
    complianceReady(),
  ]);
  if (!req || req.status !== "PENDING") return { error: "This request has already been dealt with. Reload the page." };
  if (!ready.ready) return { error: inviteBlockReason(ready) ?? "Invites are paused." };
  // Look again: the directory may have changed since they confirmed.
  const existing = await db.angel.findFirst({
    where: { email: { equals: req.email, mode: "insensitive" }, erasedAt: null },
    select: { id: true, name: true, status: true, archivedAt: true, user: { select: { id: true } } },
  });
  if (existing?.user) return { error: `${existing.name} already has a login. Decline this request; they can sign in.` };
  if (existing?.archivedAt) return { error: `${existing.name} is archived in the directory. Restore them first, then approve.` };
  const clash = await loginClash(req.email, "Partners use Angel View instead.");
  if (clash) return { error: clash };

  const detail = `Approved sign-up request (link "${req.link.label}")`;
  const angel =
    existing ??
    (await db.angel.create({
      data: { name: req.name, email: req.email, status: "PROSPECT", source: `Sign-up link: ${req.link.label}`, createdById: admin.id },
      select: { id: true, name: true, status: true, archivedAt: true, user: { select: { id: true } } },
    }));
  const claimed = await db.memberJoinRequest.updateMany({
    where: { id: req.id, status: "PENDING" },
    data: { status: "APPROVED", angelId: angel.id, decidedById: admin.id, decidedAt: new Date() },
  });
  if (claimed.count !== 1) return { error: "This request has already been dealt with. Reload the page." };
  const { link, expiresAt } = await issueAngelLink(angel.id, "INVITE", admin.id, detail);
  const emailed = await emailAndLog("MEMBER_INVITE", req.email, angel, link, expiresAt, admin, { welcomeOrInvite: true });
  return { ok: true, angelId: angel.id, link, ...emailed };
}

/** A partner declines: nothing is sent (they can be invited later from the directory). */
export async function declineJoinRequest(requestId: string, adminId: string): Promise<{ ok?: boolean; error?: string }> {
  const r = await db.memberJoinRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "DECLINED", decidedById: adminId, decidedAt: new Date() },
  });
  return r.count === 1 ? { ok: true } : { error: "This request has already been dealt with. Reload the page." };
}
