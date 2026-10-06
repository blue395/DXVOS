"use server";

// Public: the one-time link is the only credential here. It's claimed atomically, so a
// link can't be used twice, even by two clicks at once.

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";
import { findUsableTeamInvite } from "./invite";

const PasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords don't match." });

const EXPIRED = "This link has expired or has already been used. Ask a DXV partner for a new one.";

export async function acceptTeamInvite(token: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const invite = await findUsableTeamInvite(token);
  if (!invite) return { error: EXPIRED };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const claim = (tx: Pick<typeof db, "teamInvite">) =>
    tx.teamInvite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } });

  let userId: string;
  if (invite.kind === "INVITE") {
    if (await db.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
      return { error: "That email already has a login. Sign in instead, or ask for a password reset link." };
    }
    try {
      userId = await db.$transaction(async (tx) => {
        if ((await claim(tx)).count !== 1) throw new Error("claimed");
        const user = await tx.user.create({ data: { email: invite.email, name: invite.name, passwordHash, role: "ADMIN", lastSignInAt: new Date() } });
        await tx.teamInvite.update({ where: { id: invite.id }, data: { userId: user.id } });
        await tx.teamEvent.create({ data: { subjectId: user.id, email: user.email, kind: "joined", actorId: user.id } });
        return user.id;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "claimed") return { error: EXPIRED };
      throw e;
    }
  } else {
    const target = invite.user!;
    const ok = await db.$transaction(async (tx) => {
      if ((await claim(tx)).count !== 1) return false;
      await tx.user.update({ where: { id: target.id }, data: { passwordHash, lastSignInAt: new Date(), sessionVersion: { increment: 1 } } }); // ends any other session
      await tx.teamEvent.create({ data: { subjectId: target.id, email: invite.email, kind: "password-reset", actorId: target.id } });
      return true;
    });
    if (!ok) return { error: EXPIRED };
    userId = target.id;
  }

  await createSession(userId);
  redirect("/");
}
