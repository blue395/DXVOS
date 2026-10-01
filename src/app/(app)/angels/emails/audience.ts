import "server-only";
// Everyone a bulk email could go to, grouped by audience (shared by the composer page and
// the create action, which re-checks the chosen people server-side).
import { db } from "@/lib/db";
import { MEMBER_EMAIL_AUDIENCES, memberEmailAudience, type MemberEmailAudience } from "@/lib/pipeline";

export async function loadAudiences() {
  const angels = await db.angel.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true, archivedAt: true, emailOptOutAt: true, user: { select: { id: true } } },
  });
  const rows = angels.map((a) => ({ ...a, hasLogin: !!a.user }));
  return MEMBER_EMAIL_AUDIENCES.map((aud) => {
    const r = memberEmailAudience(rows, aud.key);
    return {
      key: aud.key as MemberEmailAudience,
      label: aud.label,
      note: aud.note,
      noEmail: r.noEmail,
      optedOut: r.optedOut,
      people: r.included.map((a) => ({ id: a.id, name: a.name, email: a.email!, hasLogin: a.hasLogin })),
    };
  });
}
export type Audience = Awaited<ReturnType<typeof loadAudiences>>[number];
