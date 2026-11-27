import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatDateTime } from "@/components/ui";
import { describesAsLabel } from "@/content/course";
import { requireCourseUser } from "@/lib/auth";
import { loadCourseAccount } from "@/lib/course-learners";
import { approvedStatementCriteria } from "@/lib/course-statements";
import { changeDescription } from "../actions";
import { LearnCard, learnHeading, learnLink, learnMuted } from "../card";
import { DescribeOptions } from "../describe-options";
import { CourseSignOut, DeleteCourseDataForm, SyndicateContactForm } from "./forms";

const REQUEST_STATUS: Record<string, string> = {
  PENDING: "Waiting for a DXV partner to review it.",
  APPROVED: "Approved: check your email for your invitation to the DXV Deal Platform.",
  DECLINED: "A DXV partner has reviewed it. We'll be in touch if anything changes.",
  WITHDRAWN: "You withdrew it.",
};

// The signed-in login's own course account.
export default async function CourseAccountPage({ searchParams }: PageProps<"/learn/account">) {
  const [user, sp] = await Promise.all([requireCourseUser(), searchParams]);
  const [account, statements] = await Promise.all([loadCourseAccount(user.id), approvedStatementCriteria()]);
  const learnerOnly = user.role === "LEARNER";
  return (
    <div className="space-y-5">
      <LearnCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={learnHeading}>Your account</h1>
            <p className={learnMuted}>
              {user.name} · {user.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/learn" className="rounded-full bg-[#fbe45b] px-4 py-2 text-sm font-semibold text-[#1a3c35]">
              Back to the course
            </a>
            {/* Members and partners have the portal header (with Sign out) above. */}
            {learnerOnly && <CourseSignOut />}
          </div>
        </div>
        {sp.deleted && <p className="rounded-md bg-[#fbe45b]/40 px-3 py-2 text-sm">Your course data has been deleted.</p>}
        {!learnerOnly && <p className="text-sm">You&apos;re using the course with your DXV member login. Your course progress is kept with it.</p>}
      </LearnCard>

      {learnerOnly && (
        <LearnCard>
          <h2 className="text-lg font-semibold">About you</h2>
          <p className={`text-sm ${learnMuted}`}>You said: {describesAsLabel(account.learner.describesAs)}.</p>
          <ActionForm action={changeDescription} resetOnSuccess={false} className="space-y-3">
            <DescribeOptions current={account.learner.describesAs} statements={statements} />
            <SubmitButton variant="secondary">Save</SubmitButton>
          </ActionForm>
        </LearnCard>
      )}

      {learnerOnly && (
        <LearnCard>
          <h2 className="text-lg font-semibold">Joining the DXV syndicate</h2>
          <SyndicateContactForm given={account.syndicateContact?.given ?? false} />
          {account.syndicateContact && (
            <p className={`text-xs ${learnMuted}`}>Last changed {formatDateTime(account.syndicateContact.createdAt)}. You can change your mind at any time.</p>
          )}
          {account.request && <p className="text-sm">Your request: {REQUEST_STATUS[account.request.status] ?? "Received."}</p>}
        </LearnCard>
      )}

      <LearnCard>
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className={`text-sm ${learnMuted}`}>
          See the{" "}
          <Link href="/learn/privacy" className={learnLink}>
            course privacy notice
          </Link>{" "}
          for what we keep and why.
        </p>
        <p>
          <a href="/api/learn/my-data" className={learnLink}>
            Download my course data (JSON)
          </a>
        </p>
        <div className="space-y-2 border-t border-[#d6dfda] pt-4 dark:border-[#274540]">
          <h3 className="font-semibold">{learnerOnly ? "Delete my account" : "Delete my course data"}</h3>
          <p className={`text-sm ${learnMuted}`}>
            {learnerOnly
              ? "This deletes your course account, progress, notes and answers, and closes your login. It can't be undone."
              : "This deletes your course progress, notes and answers. Your DXV member login and membership are not affected."}
          </p>
          <DeleteCourseDataForm learnerOnly={learnerOnly} />
        </div>
      </LearnCard>
    </div>
  );
}
