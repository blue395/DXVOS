import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSessionUserId } from "./session";

// The real access check. proxy.ts only does an optimistic redirect for signed-out
// visitors; every page and server action must call requireAdmin() itself, because
// server actions can be invoked directly and the proxy is not a security boundary.

/** Current user or null. `cache` dedupes the lookup within a single request. */
export const getCurrentUser = cache(async () => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");
  return user;
}
