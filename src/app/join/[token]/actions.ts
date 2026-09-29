"use server";

// Public: the one-time link is the only credential here. It's claimed atomically, so a
// link can't be used twice, even by two clicks at once.

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";
import { findUsableInvite } from "./invite";

const PasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
    confirm: z.string(),
    terms: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords don't match." });

const EXPIRED = "This link has expired or has already been used. Ask the DXV team for a new one.";

export async function acceptInvite(token: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const invite = await findUsableInvite(token);
  if (!invite) return { error: EXPIRED };
  const angel = invite.angel;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let userId: string;

  if (invite.kind === "INVITE") {
    if (parsed.data.terms !== "on") return { error: "Please read and accept the member terms to continue." };
    if (!angel.email) return { error: "Your invite is missing an email address. Ask the DXV team for a new link." };
    if (angel.user) return { error: "You already have a login. Sign in instead." };
    const terms = await db.complianceText.findFirst({ where: { kind: "MEMBER_TERMS", status: "APPROVED" }, select: { id: true, version: true } });
    if (!terms) return { error: "Sign-up is paused just now. Please try again later." };
    const email = angel.email;
    try {
      userId = await db.$transaction(async (tx) => {
        const claimed = await tx.angelInvite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
        if (claimed.count !== 1) throw new Error("claimed");
        const user = await tx.user.create({ data: { email, name: angel.name, passwordHash, role: "ANGEL", angelId: angel.id, lastSignInAt: new Date() } });
        await tx.angel.update({
          where: { id: angel.id },
          data: {
            termsAcceptedAt: new Date(),
            termsVersionId: terms.id,
            // Accepting an invite makes a prospect a member.
            ...(angel.status === "PROSPECT" ? { status: "MEMBER" as const, joinedAt: angel.joinedAt ?? new Date() } : {}),
          },
        });
        await tx.angelEvent.createMany({
          data: [
            { angelId: angel.id, kind: "joined", detail: `Set up their login${ip ? ` from ${ip}` : ""}`, actorId: user.id },
            { angelId: angel.id, kind: "terms-accepted", detail: `Member terms version ${terms.version}`, actorId: user.id },
          ],
        });
        return user.id;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "claimed") return { error: EXPIRED };
      throw e;
    }
  } else {
    if (!angel.user || angel.user.disabledAt) return { error: EXPIRED };
    const target = angel.user.id;
    const ok = await db.$transaction(async (tx) => {
      const claimed = await tx.angelInvite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: target }, data: { passwordHash, lastSignInAt: new Date() } });
      await tx.angelEvent.create({ data: { angelId: angel.id, kind: "password-reset", actorId: target } });
      return true;
    });
    if (!ok) return { error: EXPIRED };
    userId = target;
  }

  await createSession(userId);
  redirect("/portal");
}
