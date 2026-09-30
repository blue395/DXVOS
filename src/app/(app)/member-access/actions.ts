"use server";

// A team member sets up their own member (angel) access: their team login is linked to
// their angel record (or a new one), so the same login reaches the member portal.
// Only ever the signed-in team member's own login.

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";

export async function setUpMyMemberAccess(angelId: string | null): Promise<ActionResult> {
  const me = await requireAdmin();
  if (me.angelId) redirect("/portal");

  if (angelId) {
    const angel = await db.angel.findUnique({ where: { id: angelId }, select: { id: true, name: true, status: true, joinedAt: true, archivedAt: true, user: { select: { id: true } } } });
    if (!angel || angel.archivedAt) return { error: "That angel record isn't available." };
    if (angel.user) return { error: `${angel.name} already has a login.` };
    await db.$transaction([
      db.user.update({ where: { id: me.id }, data: { angelId: angel.id } }),
      // Partners are members of the syndicate.
      ...(angel.status !== "MEMBER"
        ? [db.angel.update({ where: { id: angel.id }, data: { status: "MEMBER", joinedAt: angel.joinedAt ?? new Date(), updatedById: me.id } })]
        : []),
      db.angelEvent.create({ data: { angelId: angel.id, kind: "linked-team-login", detail: `${me.name} linked their own team login`, actorId: me.id } }),
      db.teamEvent.create({ data: { subjectId: me.id, email: me.email, kind: "member-linked", detail: `Angel record: ${angel.name}`, actorId: me.id } }),
    ]);
  } else {
    const emailUsed = await db.angel.findUnique({ where: { email: me.email }, select: { name: true } });
    if (emailUsed) return { error: `There's already an angel record with your email (${emailUsed.name}): choose it above.` };
    await db.$transaction(async (tx) => {
      const angel = await tx.angel.create({
        data: { name: me.name, email: me.email, status: "MEMBER", joinedAt: new Date(), source: "DXV team", createdById: me.id, updatedById: me.id },
      });
      await tx.user.update({ where: { id: me.id }, data: { angelId: angel.id } });
      await tx.angelEvent.create({ data: { angelId: angel.id, kind: "linked-team-login", detail: `${me.name} created their member record from their team login`, actorId: me.id } });
      await tx.teamEvent.create({ data: { subjectId: me.id, email: me.email, kind: "member-linked", detail: `New angel record: ${angel.name}`, actorId: me.id } });
    });
  }
  redirect("/portal");
}
