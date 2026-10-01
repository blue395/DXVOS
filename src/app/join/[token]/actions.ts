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
import { createLoginFromInvite, findUsableInvite } from "./invite";

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
    const made = await createLoginFromInvite(invite, passwordHash, ip, "Set up their login");
    if ("error" in made) return { error: made.error };
    userId = made.userId;
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
