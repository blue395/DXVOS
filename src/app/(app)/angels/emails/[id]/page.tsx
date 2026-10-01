import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/components/ui";
import { EmailPreview } from "@/components/email-preview";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_EMAIL_AUDIENCES } from "@/lib/pipeline";
import { SendProgress } from "./send-progress";

export const metadata = { title: "Email · DXV OS" };

const STATUS_LABEL = { PENDING: "Not sent yet", SENDING: "Sending (or interrupted)", SENT: "Sent", FAILED: "Didn't send" } as const;

export default async function MemberEmailPage({ params, searchParams }: PageProps<"/angels/emails/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const email = await requireAdminWith(() =>
    db.memberEmail.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } }, recipients: { orderBy: { angel: { name: "asc" } }, include: { angel: { select: { id: true, name: true } } } } },
    }),
  );
  if (!email) notFound();
  const n = (s: keyof typeof STATUS_LABEL) => email.recipients.filter((r) => r.status === s).length;
  const counts = { sent: n("SENT"), failed: n("FAILED"), pending: n("PENDING"), sending: n("SENDING") };
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/angels/emails" className="text-sm text-dxv-green hover:underline">
        ← Email angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{email.subject}</h1>
        <p className="text-sm text-black/60">
          {formatDateTime(email.createdAt)} · by {email.createdBy.name} · {MEMBER_EMAIL_AUDIENCES.find((a) => a.key === email.audience)?.label ?? email.audience} ·{" "}
          {email.recipients.length} {email.recipients.length === 1 ? "angel" : "angels"}
        </p>
      </div>
      <SendProgress id={email.id} total={email.recipients.length} initial={counts} autoStart={sp.send === "1"} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">Who it went to</h2>
          <ul className="divide-y divide-black/10 text-sm">
            {email.recipients.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  <Link href={`/angels/${r.angel.id}`} className="hover:underline">
                    {r.angel.name}
                  </Link>{" "}
                  <span className="text-black/50">{r.email}</span>
                  {r.invited && <span className="ml-1 text-xs text-black/50">· with a sign-up link</span>}
                  {r.error && <span className="block text-xs text-black/60">{r.error}</span>}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "SENT" ? "bg-dxv-green text-white" : r.status === "FAILED" ? "bg-dxv-yellow text-dxv-green" : "bg-black/5"}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-2">
          <p className="text-sm font-medium text-black/70">The email (shown for Ada)</p>
          <EmailPreview subject={email.subject} body={email.body} firstName="Ada" link="https://example.com/their-own-link" bulk />
        </div>
      </div>
    </div>
  );
}
