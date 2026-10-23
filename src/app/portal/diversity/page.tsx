import { redirect } from "next/navigation";
import { DiversityForm } from "@/components/portal/diversity-form";
import { OnboardingStepper } from "@/components/portal/stepper";
import { requireAngel } from "@/lib/auth";
import { CarriedOverNote, ConsentIntro } from "@/components/portal/diversity-parts";
import { byCategory } from "@/lib/diversity/questions";
import { loadMyDiversity } from "@/lib/diversity/store";
import { trackPortalView } from "@/lib/portal-analytics";
import { saveDiversityAnswers } from "./actions";

export const metadata = { title: "About you (optional) · DXV Members" };

/**
 * The optional diversity step, its own screen after the profile (docs/privacy: separate
 * from the terms and privacy notice). Answers carried over from the old profile pills are
 * pre-filled for the member to confirm, change or clear; nothing is kept without consent.
 */
export default async function DiversityStepPage() {
  const who = await requireAngel();
  const [mine] = await Promise.all([loadMyDiversity(who.angel.id), trackPortalView(who, "OTHER")]);
  if (who.angel.diversityPromptedAt) redirect("/portal/profile/diversity");
  return (
    <div className="space-y-4">
      <OnboardingStepper current="diversity" />
      <ConsentIntro />
      {mine.pending.length > 0 && <CarriedOverNote expires={mine.pendingExpiresAt} />}
      <section className="rounded-lg border border-black/10 bg-white p-5">
        <DiversityForm
          mode="onboarding"
          saved={byCategory(mine.answers)}
          carriedOver={byCategory(mine.pending)}
          consentGiven={mine.consents.filter((c) => c.status === "given").map((c) => c.category)}
          action={saveDiversityAnswers.bind(null, "onboarding")}
        />
      </section>
    </div>
  );
}
