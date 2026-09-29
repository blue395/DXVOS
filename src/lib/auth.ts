import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSessionUserId } from "./session";

// The real access check. proxy.ts only does an optimistic redirect for signed-out
// visitors; every page and server action must call requireAdmin() itself, because
// server actions can be invoked directly and the proxy is not a security boundary.

/** Current user or null (a revoked login, or an archived angel's, counts as signed out). `cache` dedupes the lookup within a request. */
export const getCurrentUser = cache(async () => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, angelId: true, disabledAt: true, angel: { select: { archivedAt: true } } },
  });
  if (!user || user.disabledAt) return null;
  // An angel login whose Angel record is gone or archived is signed out (never a redirect loop).
  if (user.role === "ANGEL" && (!user.angel || user.angel.archivedAt)) return null;
  return user;
});

/** Where a signed-in user belongs: the team's app, or an angel's portal. */
export const homeFor = (role: string) => (role === "ANGEL" ? "/portal" : "/");

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect(homeFor(user.role)); // angels never see team pages
  return user;
}

/**
 * The angel portal's check: a signed-in angel with an active Angel record. Every portal
 * page and action calls it, and only ever reads or writes that angel's own data.
 */
export async function requireAngel() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ANGEL" || !user.angelId) redirect(homeFor(user.role));
  const angel = await db.angel.findUnique({ where: { id: user.angelId } });
  if (!angel || angel.archivedAt) redirect("/login");
  return { user, angel };
}

/**
 * Pages: check the admin and load the page's data at the same time (saves one
 * round trip to the database per page view). The data is only returned if the
 * check passes; if it fails, requireAdmin() redirects to /login.
 * Reads only: server actions must call requireAdmin() before they write anything.
 */
export async function requireAdminWith<T>(load: () => Promise<T>): Promise<T> {
  const [, data] = await Promise.all([requireAdmin(), load()]);
  return data;
}
