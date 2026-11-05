import Link from "next/link";
import { Card, formatDate } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { appOrigin } from "@/lib/mail";
import { formatGbpCompact } from "@/lib/pipeline";
import { CopyLink } from "./copy-link";

export const metadata = { title: "Website submissions · DXV OS" };

// Founders who applied through the public /apply page: what came in, what the AI made of
// each deck (a suggestion: the team decides), and whether the founder was thanked.
export default async function SubmissionsPage() {
  const subs = await requireAdminWith(() =>
    db.founderSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        venture: {
          select: {
            id: true,
            name: true,
            currentStage: true,
            deckAnalyses: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, screen: true } },
            founderEmails: { where: { kind: "ACKNOWLEDGEMENT" }, select: { error: true } },
          },
        },
      },
    }),
  );
  const link = `${appOrigin() ?? ""}/apply`;
  const hourAgo = new Date().getTime() - 3_600_000;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/deals/founder-emails" className="text-sm text-dxv-green hover:underline">
        ← Email founders
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Website submissions</h1>
        <p className="text-sm text-black/60">
          Founders apply on DXV&apos;s application page. Each submission lands in Submitted on the board, the AI reads the deck and suggests an eligibility
          verdict (the team decides), and the founder gets an acknowledgement from angels@diversityx.vc. The founder email templates and the partners&apos;
          digest are on Email founders.
        </p>
      </div>

      <Card title="Your application link">
        <div className="space-y-2 text-sm">
          <CopyLink url={link} />
          <p className="text-black/60">
            Add it to the Founders page on Squarespace as a button (&ldquo;Submit your deck&rdquo;).{" "}
            <a href="/apply" target="_blank" rel="noreferrer" className="font-medium text-dxv-green underline">
              Open the page
            </a>
          </p>
        </div>
      </Card>

      <Card title={`Submissions (${subs.length})`}>
        {subs.length === 0 ? (
          <p className="text-sm text-black/55">No website submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-black/50">
                <tr>
                  <th className="py-1.5 font-medium">Received</th>
                  <th className="py-1.5 font-medium">Company</th>
                  <th className="py-1.5 font-medium">Founder</th>
                  <th className="py-1.5 font-medium">Stage · raise</th>
                  <th className="py-1.5 font-medium">AI suggests</th>
                  <th className="py-1.5 font-medium">Founder thanked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {subs.map((s) => {
                  const analysis = s.venture?.deckAnalyses[0];
                  const screen = analysis?.screen as { recommendation?: string } | null | undefined;
                  const ack = s.venture?.founderEmails[0];
                  const abandoned = s.status === "UPLOADING" && s.createdAt.getTime() < hourAgo;
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="py-2 text-black/60">{formatDate(s.createdAt)}</td>
                      <td className="py-2">
                        {s.venture ? (
                          <Link href={`/deals/${s.venture.id}`} className="font-medium hover:text-dxv-green hover:underline">
                            {s.companyName}
                          </Link>
                        ) : (
                          <span className="font-medium">{s.companyName}</span>
                        )}
                        {s.resubmission && <span className="block text-xs text-black/55">New deck for a deal already on the board</span>}
                        {s.previousVentureId && <span className="block text-xs text-black/55">Declined before</span>}
                        {s.status !== "COMPLETE" && (
                          <span className="block text-xs text-black/55">{abandoned ? "The deck never finished uploading" : "Uploading…"}</span>
                        )}
                      </td>
                      <td className="py-2">
                        {s.founderNames}
                        <span className="block text-xs text-black/55">{s.email}</span>
                      </td>
                      <td className="py-2 text-black/70">
                        {s.companyStage} · {s.raiseAmountGbp ? formatGbpCompact(s.raiseAmountGbp) : "–"}
                        <span className="block text-xs text-black/55">{s.sector}</span>
                      </td>
                      <td className="py-2">
                        {screen?.recommendation ? (
                          <span className="rounded-full bg-dxv-green/10 px-2 py-0.5 text-xs font-medium text-dxv-green">{screen.recommendation}</span>
                        ) : analysis?.status === "FAILED" ? (
                          <span className="text-xs text-black/60">Reading failed: re-run on the deal</span>
                        ) : s.status === "COMPLETE" ? (
                          <span className="text-xs text-black/55">Reading…</span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-2 text-xs">{ack ? (ack.error ? "Email didn't send" : "✓ Emailed") : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
