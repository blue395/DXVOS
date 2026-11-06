import "server-only";
// Everyone a bulk email could go to, grouped by audience (shared by the composer page and
// the create action, which re-checks the chosen people server-side).
import { db } from "@/lib/db";
import { MEMBER_EMAIL_AUDIENCES, memberEmailAudience, type MemberEmailAudience } from "@/lib/pipeline";
import { angelIdsWithDealAccess } from "@/lib/portal-deals";

export async function loadAudiences() {
  const [angels, dealAccess] = await Promise.all([
    db.angel.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, status: true, archivedAt: true, emailOptOutAt: true, user: { select: { id: true } } },
    }),
    angelIdsWithDealAccess(), // who may receive deal material (an opportunities pack)
  ]);
  const rows = angels.map((a) => ({ ...a, hasLogin: !!a.user, dealAccess: dealAccess.has(a.id) }));
  return MEMBER_EMAIL_AUDIENCES.map((aud) => {
    const r = memberEmailAudience(rows, aud.key);
    return {
      key: aud.key as MemberEmailAudience,
      label: aud.label,
      note: aud.note,
      noEmail: r.noEmail,
      optedOut: r.optedOut,
      people: r.included.map((a) => ({ id: a.id, name: a.name, email: a.email!, hasLogin: a.hasLogin, dealAccess: dealAccess.has(a.id) })),
    };
  });
}
export type Audience = Awaited<ReturnType<typeof loadAudiences>>[number];
