import "server-only";
// Turning bulk member emails off (or back on) for an angel, logged in their activity.
import { db } from "./db";

export async function setEmailOptOut(angelId: string, optOut: boolean, how: string) {
  const angel = await db.angel.findUnique({ where: { id: angelId }, select: { id: true, emailOptOutAt: true } });
  if (!angel) return false;
  if (!!angel.emailOptOutAt === optOut) return true;
  await db.$transaction([
    db.angel.update({ where: { id: angelId }, data: { emailOptOutAt: optOut ? new Date() : null } }),
    db.angelEvent.create({ data: { angelId, kind: optOut ? "unsubscribed" : "resubscribed", detail: how } }),
  ]);
  return true;
}
