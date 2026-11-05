import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailPreview } from "@/components/email-preview";
import { SendProgress } from "@/components/send-progress";
import { formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/documents";
import { retryFounderBulkEmail, sendFounderBulkBatch } from "../actions";

export const metadata = { title: "Email to founders · DXV OS" };

const STATUS_LABEL = { PENDING: "Not sent yet", SENDING: "Sending (or interrupted)", SENT: "Sent", FAILED: "Didn't send" } as const;

export default async function FounderBulkEmailPage({ params, searchParams }: PageProps<"/deals/founder-emails/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const email = await requireAdminWith(() =>
    db.founderBulkEmail.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        recipients: { orderBy: { venture: { name: "asc" } }, include: { venture: { select: { id: true, name: true } } } },
        attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, sizeBytes: true } },
      },
    }),
  );
  if (!email) notFound();
  const n = (s: keyof typeof STATUS_LABEL) => email.recipients.filter((r) => r.status === s).length;
  const counts = { sent: n("SENT"), failed: n("FAILED"), pending: n("PENDING"), sending: n("SENDING") };
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/deals/founder-emails" className="text-sm text-dxv-green hover:underline">
        ← Email founders
      </Link>
      <div>
        <h1 className="break-words text-2xl font-semibold text-dxv-green">{email.subject}</h1>
        <p className="text-sm text-black/60">
          {formatDateTime(email.createdAt)} · by {email.createdBy.name} · {email.audience} · {email.recipients.length}{" "}
          {email.recipients.length === 1 ? "founder" : "founders"}
        </p>
        {email.attachments.length > 0 && (
          <p className="mt-1 text-sm text-black/70">Attached: {email.attachments.map((a) => `${a.fileName} (${formatFileSize(a.sizeBytes)})`).join(", ")}</p>
        )}
      </div>
      <SendProgress
        id={email.id}
        total={email.recipients.length}
        initial={counts}
        autoStart={sp.send === "1"}
        sendBatch={sendFounderBulkBatch}
        retry={retryFounderBulkEmail}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-black/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">Who it went to</h2>
          <ul className="divide-y divide-black/10 text-sm">
            {email.recipients.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <Link href={`/deals/${r.venture.id}`} className="font-medium hover:underline">
                    {r.venture.name}
                  </Link>{" "}
                  <span className="break-all text-black/50">{r.email}</span>
                  {r.error && <span className="block text-xs text-black/60">{r.error}</span>}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${r.status === "SENT" ? "bg-dxv-green text-white" : r.status === "FAILED" ? "bg-dxv-yellow text-dxv-green" : "bg-black/5"}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-black/70">The email (shown for the first company)</p>
          <EmailPreview subject={email.subject} body={email.body} firstName="Ada" company={email.recipients[0]?.venture.name ?? "Example Ltd"} bulk={false} />
        </div>
      </div>
    </div>
  );
}
