import Link from "next/link";
import { buttonClass, Card, StageBadge } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { loadAssessmentQueue } from "@/lib/assessments";
import { ASSESSMENT_STATUS_LABELS, daysSince, type AssessmentStatus } from "@/lib/pipeline";

export const metadata = { title: "Investment assessments to do · DXV OS" };

// From the Dashboard's Investment Assessment tile: deals at DXV Partner Review or Member
// Pitch Selection whose investment memo (a DXV Review Issue) isn't issued yet.
const ORDER: AssessmentStatus[] = ["not-started", "drafting", "ai-draft", "in-review"];
const NEXT: Record<AssessmentStatus, string> = {
  "not-started": "Generate AI assessment",
  drafting: "Check progress",
  "ai-draft": "Review the AI draft",
  "in-review": "Finish and issue",
};

export default async function AssessmentsToDoPage() {
  const rows = await requireAdminWith(() => loadAssessmentQueue());
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <Link href="/" className="text-sm text-dxv-green hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-dxv-green">Investment assessments to do</h1>
        <p className="text-sm text-black/60">
          Deals at DXV Partner Review or Member Pitch Selection without an issued memo (a DXV Review Issue). Members see the memo from Member Pitch Selection,
          so these come first.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-black/60">✓ Every deal at DXV Partner Review and Member Pitch Selection has an issued memo.</p>
        </Card>
      ) : (
        ORDER.filter((st) => rows.some((r) => r.status === st)).map((st) => {
          const group = rows.filter((r) => r.status === st);
          return (
            <Card key={st} title={`${ASSESSMENT_STATUS_LABELS[st]} (${group.length})`}>
              <ul className="divide-y divide-black/10">
                {group.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <span className="min-w-0 flex-1 basis-full sm:basis-0">
                      <Link href={`/deals/${r.id}`} className="font-semibold text-dxv-green hover:underline">
                        {r.name}
                      </Link>
                      {r.oneLiner && <span className="block text-sm text-black/65">{r.oneLiner}</span>}
                      <span className="block text-xs text-black/50">
                        {r.round ? `Round ${r.round} · ` : ""}
                        {daysSince(r.stageEnteredAt, now)}d in stage
                      </span>
                    </span>
                    <StageBadge stage={r.currentStage} />
                    <Link href={`/deals/${r.id}/assessment`} className={buttonClass()}>
                      {NEXT[st]} →
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}
