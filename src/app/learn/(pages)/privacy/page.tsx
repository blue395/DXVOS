import { coursePrivacyNotice } from "@/content/course";
import { PRIVACY_FACTS } from "@/content/privacy-notice";
import { LearnCard, learnHeading, learnMuted } from "../card";

export const metadata = { title: "Course privacy notice · Diversity X Ventures" };

// Public: the Angel Foundations course privacy notice (UK GDPR). DRAFT for Kevin.
export default function CoursePrivacyPage() {
  const sections = coursePrivacyNotice("angels@diversityx.vc", PRIVACY_FACTS.legalName ?? "Diversity X Ventures");
  return (
    <LearnCard>
      <h1 className={learnHeading}>Course privacy notice</h1>
      <p className={`text-sm ${learnMuted}`}>For Angel Investing Foundations, DXV&apos;s free online course.</p>
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {s.text.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
    </LearnCard>
  );
}
