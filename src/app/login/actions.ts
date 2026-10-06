"use server";

import { clientIp, hashIp } from "@/lib/client-ip";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession, signOutEverywhere } from "@/lib/session";
import { getCurrentUser, homeFor } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { newInviteToken } from "@/lib/invite-token";
import { findUsableLoginLink, loginLinkEvent } from "@/lib/login-links";
import { loginLinkEmail } from "@/lib/login-email";
import { appOrigin, mailConfigured, sendMail } from "@/lib/mail";
import { LOGIN_LIMITS, LOGIN_LINK_MINUTES, LOGIN_LINKS_PER_HOUR, LOGIN_PAUSED_MESSAGE, MIN_PASSWORD_LENGTH, canSignIn, loginThrottled } from "@/lib/pipeline";

// Pre-computed hash of a random string. Comparing against it when the email is
// unknown makes "no such user" take as long as "wrong password".
const DUMMY_HASH = "$2b$12$3aeQTGIIJcozlbgapidaFuazz8rHyj/eSW0rrcQUgPfUP614nYA4a";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };

  const { email } = parsed.data;
  const ipHash = hashIp(clientIp(await headers()));
  const since = new Date(Date.now() - LOGIN_LIMITS.windowMinutes * 60_000);
  const [user, emailFailures, ipFailures] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.loginAttempt.findMany({ where: { email, ok: false, createdAt: { gt: since } }, select: { createdAt: true }, take: LOGIN_LIMITS.perEmail }),
    ipHash ? db.loginAttempt.count({ where: { ipHash, ok: false, createdAt: { gt: since } } }) : 0,
  ]);
  // Too many wrong passwords: pause before even checking this one (emailed links still work).
  if (loginThrottled({ emailFailures: emailFailures.map((f) => f.createdAt), ipFailures, lastSignInAt: user?.lastSignInAt ?? null }, new Date())) {
    return { error: LOGIN_PAUSED_MESSAGE };
  }
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  const ok = !!user && valid && !user.disabledAt;
  await db.loginAttempt.create({ data: { email, ipHash, ok } });
  if (!ok) return { error: "Incorrect email or password." };

  await db.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

/** "Sign out other devices": ends every other session for this login (e.g. a lost phone), keeping this browser signed in. */
export async function signOutOtherDevices(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  await db.$transaction([signOutEverywhere(me.id), loginLinkEvent(me, "signed-out-everywhere", "Signed out of every other device")]);
  await createSession(me.id);
  return { ok: true };
}

// ── "Forgot password?": emailed one-time links (any login, team or member) ──

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  kind: z.enum(["MAGIC", "RESET"]),
});

/** Every request takes at least this long, so the response time doesn't reveal whether an email has a login. */
const MIN_REQUEST_MS = 1500;
const LINK_EXPIRED = "This link has expired or has already been used. Ask for a new one below.";

/**
 * Email a one-time link: MAGIC signs them straight in, RESET lets them choose a new password.
 * The answer is the same whether or not the email has a login (no account fishing).
 */
export async function requestLoginLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const started = Date.now();
  const parsed = RequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter the email address you sign in with." };
  const origin = appOrigin();
  if (!origin || !mailConfigured()) return { error: "Emailed links aren't set up yet. Ask the DXV team for a reset link." };
  const { email, kind } = parsed.data;
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, angelId: true, disabledAt: true, angel: { select: { archivedAt: true } } },
    });
    if (user && canSignIn(user)) {
      const recent = await db.loginLink.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
      if (recent < LOGIN_LINKS_PER_HOUR) {
        const { token, tokenHash } = newInviteToken();
        const minutes = LOGIN_LINK_MINUTES[kind];
        const ip = clientIp(await headers());
        await db.$transaction([
          db.loginLink.updateMany({ where: { userId: user.id, kind, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
          db.loginLink.create({ data: { userId: user.id, kind, tokenHash, expiresAt: new Date(Date.now() + minutes * 60_000), requestedIp: ip } }),
          loginLinkEvent(user, kind === "MAGIC" ? "sign-in-link-sent" : "reset-link-emailed", `Asked for by email${ip ? ` from ${ip}` : ""}`),
        ]);
        await sendMail({ to: user.email, ...loginLinkEmail(kind, { name: user.name, link: `${origin}/login/link/${token}`, minutes }) });
      }
    }
  } catch (e) {
    console.error("Sign-in link request failed", e);
    return { error: "We couldn't send the email just now. Please try again in a few minutes." };
  } finally {
    const wait = MIN_REQUEST_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  return { ok: true };
}

/** Claim a link: exactly once, even if it's clicked twice at the same moment. */
async function claimLink(id: string) {
  const claimed = await db.loginLink.updateMany({ where: { id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return claimed.count === 1;
}

/** Magic link: sign in. A button press, not the page load, so email scanners that open links can't use it up. */
export async function signInWithLink(token: string): Promise<ActionResult> {
  const link = await findUsableLoginLink(token);
  if (!link || link.kind !== "MAGIC" || !(await claimLink(link.id))) return { error: LINK_EXPIRED };
  await Promise.all([
    db.user.update({ where: { id: link.user.id }, data: { lastSignInAt: new Date() } }),
    loginLinkEvent(link.user, "signed-in-by-link"),
  ]);
  await createSession(link.user.id);
  redirect(homeFor(link.user.role));
}

const NewPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords don't match." });

/** Reset link: set a new password, then sign in. */
export async function resetPasswordWithLink(token: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = NewPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const link = await findUsableLoginLink(token);
  if (!link || link.kind !== "RESET") return { error: LINK_EXPIRED };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  if (!(await claimLink(link.id))) return { error: LINK_EXPIRED };
  await db.$transaction([
    // A new password ends every other session (e.g. one someone else had), then signs this browser in.
    db.user.update({ where: { id: link.user.id }, data: { passwordHash, lastSignInAt: new Date(), sessionVersion: { increment: 1 } } }),
    // Any other unused link for this login stops working once the password changes.
    db.loginLink.updateMany({ where: { userId: link.user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    loginLinkEvent(link.user, "password-reset", "By emailed link"),
  ]);
  await createSession(link.user.id);
  redirect(homeFor(link.user.role));
}
