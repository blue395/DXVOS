import Link from "next/link";
import { Card, buttonClass, formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { templateProblems } from "@/lib/member-email";
import { MEMBER_EMAIL_AUDIENCES } from "@/lib/pipeline";

export const metadata = { title: "Email angels · DXV OS" };

export default async function EmailsPage() {
  const [templates, emails] = await requireAdminWith(() =>
    Promise.all([
      db.emailTemplate.findMany({ where: { archivedAt: null, NOT: { key: { startsWith: "founder-" } } }, orderBy: [{ key: { sort: "asc", nulls: "last" } }, { name: "asc" }], include: { updatedBy: { select: { name: true } } } }),
      db.memberEmail.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { createdBy: { select: { name: true } }, recipients: { select: { status: true } } },
      }),
    ]),
  );
  const canEmail = mailConfigured();
  const audienceLabel = (k: string) => MEMBER_EMAIL_AUDIENCES.find((a) => a.key === k)?.label ?? k;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Email angels</h1>
          <p className="text-sm text-black/60">
            Emails from angels@diversityx.vc, each personalised with their first name and their own link to the platform. Anyone who unsubscribes is
            left out automatically.
          </p>
        </div>
        {canEmail && (
          <Link href="/angels/emails/new" className={buttonClass("accent")}>
            New email
          </Link>
        )}
      </div>
      {!canEmail && <p className="rounded bg-dxv-yellow/40 px-3 py-2 text-sm">Email isn&apos;t set up, so emails can&apos;t be sent yet.</p>}

      <Card title="Templates">
        <p className="mb-3 text-sm text-black/60">Starting points for emails. The welcome email goes automatically with invites to new applicants (Prospects).</p>
        <ul className="divide-y divide-black/10">
          {templates.map((t) => {
            const problems = templateProblems(t);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <Link href={`/angels/emails/templates/${t.id}`} className="font-medium text-dxv-green hover:underline">
                    {t.name}
                  </Link>
                  {t.key === "welcome" && <span className="ml-2 rounded-full bg-dxv-green px-2 py-0.5 text-xs text-white">Sent with invites</span>}
                  <span className="block text-xs text-black/55">
                    {t.subject} · updated {formatDateTime(t.updatedAt)}
                    {t.updatedBy ? ` by ${t.updatedBy.name}` : ""}
                  </span>
                  {problems.length > 0 && <span className="mt-1 block rounded bg-dxv-yellow/40 px-2 py-0.5 text-xs">Needs finishing: {problems.join(" ")}</span>}
                </span>
                <span className="flex gap-2">
                  <Link href={`/angels/emails/templates/${t.id}`} className={buttonClass("secondary")}>
                    Edit
                  </Link>
                  {canEmail && t.key !== "welcome" && (
                    <Link href={`/angels/emails/new?template=${t.id}`} className={buttonClass("secondary")}>
                      Use
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/angels/emails/templates/new" className="mt-3 inline-block text-sm font-medium text-dxv-green underline">
          + New template
        </Link>
      </Card>

      <Card title="Sent">
        {emails.length === 0 ? (
          <p className="text-sm text-black/60">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-black/10">
            {emails.map((e) => {
              const n = (s: string) => e.recipients.filter((r) => r.status === s).length;
              const waiting = n("PENDING") + n("SENDING");
              return (
                <li key={e.id} className="py-2.5 text-sm">
                  <Link href={`/angels/emails/${e.id}`} className="font-medium text-dxv-green hover:underline">
                    {e.subject}
                  </Link>
                  <span className="block text-xs text-black/55">
                    {formatDateTime(e.createdAt)} · {e.createdBy.name} · {audienceLabel(e.audience)} · {n("SENT")} sent
                    {n("FAILED") > 0 && `, ${n("FAILED")} failed`}
                    {waiting > 0 && `, ${waiting} not sent yet`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
