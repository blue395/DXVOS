import "server-only";
// The daily retention jobs (docs/privacy/launch-pack.md, retention schedule), run by the
// scheduled function each morning (/api/cron/founder-digest). Returns counts only.
//
//   Diversity answers: consent withdrawn (immediate), member left, or 12 months inactive;
//     carried-over answers 60 days; consent records and access logs 6 years. (store.ts)
//   Password sign-in attempts: 30 days. Emailed sign-in link records (hold the IP): 90 days.
//   Inactive members: 24 months with no activity -> warning email -> 30 days -> smart
//     erasure (deleteAngelRecord). ONLY when RETENTION_DELETE_INACTIVE=on; until then it
//     reports how many would be warned / deleted and changes nothing.
// Backups, Netlify logs and Supabase logs expire by provider settings (docs/DEPLOY.md §12).

import { db } from "./db";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { inactivityWarningEmail } from "./login-email";
import { INACTIVE_WARNING_DAYS, inactivityAction } from "./pipeline";
import { runDiversityRetention } from "./diversity/store";
import { deleteAngelRecord } from "./angel-erasure";
import { SYSTEM_USER_ID } from "./founder-submissions";

const DAY = 86_400_000;
const latest = (...ds: (Date | null | undefined)[]) => new Date(Math.max(...ds.filter((d): d is Date => !!d).map((d) => d.getTime())));

export async function runRetention(now = new Date()) {
  const live = process.env.RETENTION_DELETE_INACTIVE === "on";
  const [diversity, attempts, links, angels] = await Promise.all([
    runDiversityRetention(now),
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } }),
    db.loginLink.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * DAY) } } }),
    db.angel.findMany({
      where: { erasedAt: null, NOT: { user: { is: { role: "ADMIN" } } } }, // partners: managed on /team
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        onboardedAt: true,
        termsAcceptedAt: true,
        inactivityWarnedAt: true,
        emailOptOutAt: true,
        user: { select: { lastSignInAt: true } },
        portalViews: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        preSelectionVotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        investmentVotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        finalInvestments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const inactive = { warned: 0, deleted: 0, warningsCancelled: 0, wouldWarn: 0, wouldDelete: 0 };
  const origin = appOrigin();
  for (const a of angels) {
    const lastActiveAt = latest(a.createdAt, a.onboardedAt, a.termsAcceptedAt, a.user?.lastSignInAt, a.portalViews[0]?.createdAt, a.preSelectionVotes[0]?.createdAt, a.investmentVotes[0]?.createdAt, a.finalInvestments[0]?.createdAt);
    const action = inactivityAction({ lastActiveAt, warnedAt: a.inactivityWarnedAt }, now);
    if (action === "cancel-warning") {
      await db.angel.update({ where: { id: a.id }, data: { inactivityWarnedAt: null } });
      inactive.warningsCancelled++;
    } else if (action === "warn") {
      if (!live) { inactive.wouldWarn++; continue; }
      const deleteOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(now.getTime() + INACTIVE_WARNING_DAYS * DAY));
      // A service message about their account: sent even if they've unsubscribed from news.
      if (a.email && mailConfigured() && origin) {
        await sendMail({ to: a.email, ...inactivityWarningEmail({ name: a.name, deleteOn, signInUrl: `${origin}/login` }) }).catch(() => console.error("Retention warning email failed"));
      }
      await db.$transaction([
        db.angel.update({ where: { id: a.id }, data: { inactivityWarnedAt: now } }),
        db.angelEvent.create({ data: { angelId: a.id, kind: "inactivity-warning", detail: `Account to be deleted on ${deleteOn} unless they sign in`, actorId: SYSTEM_USER_ID } }),
      ]);
      inactive.warned++;
    } else if (action === "delete") {
      if (!live) { inactive.wouldDelete++; continue; }
      const out = await deleteAngelRecord(a.id, { id: SYSTEM_USER_ID });
      if (!("error" in out)) inactive.deleted++;
    }
  }
  return { live, diversity, loginAttemptsDeleted: attempts.count, loginLinksDeleted: links.count, inactive };
}
