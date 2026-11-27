import { WelcomeForm } from "./welcome-form";
import { COURSE_CONSENTS } from "@/content/course";
import { requireCourseUser } from "@/lib/auth";
import { ensureCourseLearner } from "@/lib/course-learners";
import { approvedStatementCriteria } from "@/lib/course-statements";
import { LearnCard, learnHeading, learnMuted } from "../card";
import { DescribeOptions } from "../describe-options";
import { OpenCourse } from "../open-course";

// After a course learner's first sign-in: two short questions, then the course.
export default async function CourseWelcomePage() {
  const user = await requireCourseUser();
  const [learner, statements] = await Promise.all([ensureCourseLearner(user.id), approvedStatementCriteria()]);
  // Members and partners, and learners who've answered: straight into the course.
  if (user.role !== "LEARNER" || learner.describesAs)
    return (
      <LearnCard>
        <OpenCourse />
      </LearnCard>
    );
  return (
    <LearnCard>
      <div className="space-y-1">
        <h1 className={learnHeading}>Welcome, {user.name.split(" ")[0]}</h1>
        <p className={learnMuted}>Two quick questions, then you can start the course.</p>
      </div>
      <WelcomeForm>
        <DescribeOptions current={null} statements={statements} />
        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">Joining the DXV syndicate</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="syndicateContact" className="mt-1" />
            <span>{COURSE_CONSENTS.SYNDICATE_CONTACT.wording}</span>
          </label>
          <p className={`text-xs ${learnMuted}`}>
            If you tick this, a DXV partner will review your request. You will not see any investment opportunities unless DXV approves you and you complete the
            investor statement on the DXV Deal Platform.
          </p>
        </fieldset>
      </WelcomeForm>
    </LearnCard>
  );
}
