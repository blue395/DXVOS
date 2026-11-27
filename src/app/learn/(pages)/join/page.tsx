import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { COURSE_NAME } from "@/content/course";
import { currentCourseUser } from "@/lib/auth";
import { issueJoinFormToken } from "@/lib/join-links";
import { LESSON_COUNT } from "@/lib/course";
import { LearnCard, learnHeading, learnLink, learnMuted } from "../card";
import { CourseJoinForm } from "./join-form";

// Public: sign up to the Angel Foundations course (name and email; we email a link).
export default async function CourseJoinPage() {
  await connection();
  if (await currentCourseUser()) redirect("/learn");
  return (
    <LearnCard>
      <div className="space-y-2">
        <h1 className={learnHeading}>{COURSE_NAME}</h1>
        <p className={learnMuted}>
          A free course from Diversity X Ventures in {LESSON_COUNT} short lessons: building an investment thesis, finding and screening startups, due diligence,
          EIS and SEIS, building a portfolio and supporting the companies you back. Each lesson ends with a short quiz.
        </p>
        <p className={learnMuted}>Sign up with your name and email, and your progress is saved to your account so you can carry on from any device.</p>
      </div>
      <CourseJoinForm formToken={issueJoinFormToken()} />
      <p className={`text-sm ${learnMuted}`}>
        Already signed up, or a DXV member? Enter the same email above and we&apos;ll send you a sign-in link, or{" "}
        <Link href="/login" className={learnLink}>
          sign in
        </Link>
        .
      </p>
    </LearnCard>
  );
}
