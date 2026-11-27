import Link from "next/link";
import { buttonClass, Card, formatDate } from "@/components/ui";
import { describesAsLabel } from "@/content/course";
import { requireAdminWith } from "@/lib/auth";
import { loadCourseLearners } from "@/lib/course-admin";
import { LESSON_COUNT } from "@/lib/course";

export const metadata = { title: "Course learners · DXV OS" };

const REQUEST_LABEL: Record<string, string> = {
  PENDING: "Waiting for a partner",
  APPROVED: "Approved",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

// Angel Foundations course (Blue, 2026-11-27): who signed up, how far they've got, how they
// describe themselves and who'd like to hear about the syndicate. Never their notes or answers.
export default async function CourseLearnersPage() {
  const rows = await requireAdminWith(() => loadCourseLearners());
  const learners = rows.filter((r) => r.kind === "Learner");
  const wanting = learners.filter((r) => r.wantsContact);
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Course learners</h1>
          <p className="text-sm text-black/60">
            Angel Investing Foundations, the free course at{" "}
            <a href="/learn" className="underline">
              /learn
            </a>
            . {learners.length} learner
            {learners.length === 1 ? "" : "s"} signed up; {wanting.length} would like to hear about joining (their requests are under{" "}
            <Link href="/angels/invite#join-requests" className="underline">
              Invite an angel
            </Link>
            ). Members and partners use the course with their own login. Learners&apos; notes and quiz answers are private to them.
          </p>
        </div>
        <a href="/api/angels/learners" className={buttonClass("secondary")}>
          Export CSV
        </a>
      </div>
      <Card title={`Everyone on the course (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-black/55">Nobody has signed up yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-black/50">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Name</th>
                  <th className="hidden py-1.5 pr-3 font-medium md:table-cell">Describes themselves as</th>
                  <th className="py-1.5 pr-3 font-medium">Progress</th>
                  <th className="py-1.5 pr-3 font-medium">Syndicate</th>
                  <th className="hidden py-1.5 font-medium md:table-cell">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {rows.map((r) => (
                  <tr key={r.userId} className="align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{r.name}</span>
                      <span className="block break-all text-xs text-black/55">{r.email}</span>
                      <span className="text-xs text-black/55">
                        {r.kind}
                        {!r.confirmed && " · email not confirmed yet"}
                      </span>
                    </td>
                    <td className="hidden py-2 pr-3 md:table-cell">
                      {r.describesAs ? describesAsLabel(r.describesAs) : <span className="text-black/45">Not answered</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {r.summary.lessonsComplete} of {LESSON_COUNT} lessons
                      {r.summary.answeredOf > 0 && (
                        <span className="block text-xs text-black/55">
                          Quizzes: {r.summary.correct} of {r.summary.answeredOf} right
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.kind !== "Learner" ? (
                        <span className="text-black/45">Already in</span>
                      ) : r.wantsContact ? (
                        <span className="rounded-full bg-dxv-yellow px-2 py-0.5 text-xs font-semibold text-dxv-green">Yes, contact me</span>
                      ) : (
                        "No"
                      )}
                      {r.syndicateContact && <span className="block text-xs text-black/55">since {formatDate(r.syndicateContact.createdAt)}</span>}
                      {r.request && <span className="block text-xs text-black/55">Request: {REQUEST_LABEL[r.request.status] ?? r.request.status}</span>}
                    </td>
                    <td className="hidden py-2 text-xs text-black/55 md:table-cell">
                      {formatDate(r.createdAt)}
                      <br />
                      Active {formatDate(r.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
