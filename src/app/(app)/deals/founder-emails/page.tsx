import Link from "next/link";
import { Card, buttonClass, formatDate, formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { templateProblems } from "@/lib/member-email";
import { SendDigestButton } from "./send-digest";

export const metadata = { title: "Email founders · DXV OS" };

// Everything DXV emails founders, in one place: partners' bulk emails (e.g. the pitch
// session date), the templates DXV OS sends from (acknowledgement, decision updates) and the
// partners' daily digest of website submissions.
export default async function FounderEmailsPage() {
  const [emails, templates, lastDigest, submissionCount] = await requireAdminWith(() =>
    Promise.all([
      db.founderBulkEmail.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { createdBy: { select: { name: true } }, recipients: { select: { status: true } } },
      }),
      db.emailTemplate.findMany({ where: { key: { startsWith: "founder-" } }, orderBy: { key: "asc" } }),
      db.founderSubmission.findFirst({ where: { digestedAt: { not: null } }, orderBy: { digestedAt: "desc" }, select: { digestedAt: true } }),
      db.founderSubmission.count({ where: { status: "COMPLETE" } }),
    ]),
  );
  const canSend = mailConfigured();
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <Link href="/deals" className="text-sm text-dxv-green hover:underline">
        ← Deals
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Email founders</h1>
          <p className="text-sm text-black/60">
            Write one email to the founders of several deals, e.g. the date of the pitch session. Each founder gets their own copy, kept on their deal.
          </p>
        </div>
        {canSend ? (
          <Link href="/deals/founder-emails/new" className={buttonClass("accent")}>
            + New email to founders
          </Link>
        ) : (
          <p className="rounded bg-dxv-yellow/30 px-3 py-2 text-sm">Email isn&apos;t set up, so emails can&apos;t be sent yet.</p>
        )}
      </div>

      <Card title={`Sent emails (${emails.length})`}>
        {emails.length === 0 ? (
          <p className="text-sm text-black/55">No emails to founders yet.</p>
        ) : (
          <ul className="divide-y divide-black/10">
            {emails.map((e) => {
              const sent = e.recipients.filter((r) => r.status === "SENT").length;
              const notSent = e.recipients.length - sent;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/deals/founder-emails/${e.id}`} className="font-medium hover:text-dxv-green hover:underline">
                      {e.subject}
                    </Link>
                    <span className="block text-xs text-black/55">
                      {formatDate(e.createdAt)} · {e.createdBy.name} · {e.audience}
                    </span>
                  </span>
                  <span className="text-xs text-black/65">
                    {sent} of {e.recipients.length} sent{notSent > 0 ? ` · ${notSent} not sent` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Emails DXV OS sends founders">
          <p className="mb-3 text-sm text-black/60">
            The acknowledgement goes automatically when a founder applies. Decision emails are drafted from these on the deal page (Founder comms → Draft email
            to the founder): a partner checks and sends each one.
          </p>
          <ul className="divide-y divide-black/10">
            {templates.map((t) => {
              const problems = templateProblems(t);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-black/55">{t.subject}</span>
                    {problems.length > 0 && (
                      <span className="mt-1 block rounded bg-dxv-yellow/40 px-2 py-0.5 text-xs">Needs finishing: {problems.join(" ")}</span>
                    )}
                  </span>
                  <Link href={`/angels/emails/templates/${t.id}`} className={buttonClass("secondary")}>
                    Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Partners' digest">
            <div className="space-y-2 text-sm">
              <p className="text-black/65">
                Each morning (8am UK summer time, 7am in winter) every partner gets one email listing new website submissions with the AI&apos;s suggested
                verdict. Nothing is sent on days with none.
                {lastDigest?.digestedAt && ` Last sent ${formatDateTime(lastDigest.digestedAt)}.`}
              </p>
              <SendDigestButton />
            </div>
          </Card>
          <Card title="Website submissions">
            <p className="text-sm text-black/65">
              {submissionCount} {submissionCount === 1 ? "founder has" : "founders have"} applied through DXV&apos;s application page.{" "}
              <Link href="/deals/submissions" className="font-medium text-dxv-green underline">
                See the submissions and the application link
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
