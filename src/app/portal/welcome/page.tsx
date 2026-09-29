import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { OnboardingStepper } from "@/components/portal/stepper";
import { VideoSlot } from "@/components/portal/portal-home";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeLiveDeals, latestCertification, nextOnboardingStep } from "@/lib/pipeline";
import { finishOnboarding } from "../actions";

export const metadata = { title: "Welcome · DXV Members" };

export default async function WelcomePage() {
  const { angel } = await requireAngel();
  const certs = await db.angelCertification.findMany({ where: { angelId: angel.id }, select: { signedOn: true, expiresOn: true } });
  const cert = latestCertification(certs);
  const step = nextOnboardingStep(angel, cert);
  if (step === "profile" || step === "certify") redirect(`/portal/${step}`);
  const access = canSeeLiveDeals(angel, cert);
  const first = angel.name.split(" ")[0];

  return (
    <div className="space-y-5">
      {!angel.onboardedAt && <OnboardingStepper current="welcome" />}
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Welcome to DXV, {first}</h1>
        <p className="text-sm text-black/65">
          You&apos;re part of a syndicate backing underestimated founders. Here&apos;s how it works.
        </p>
      </div>
      <div className="max-w-xl">
        <VideoSlot />
      </div>
      <ol className="space-y-2 rounded-lg border border-black/10 bg-white p-4 text-sm">
        <li>
          <strong>1. Pitch selection.</strong> When DXV opens a deal to members, you&apos;ll see its pitch deck here and can say whether you&apos;d like to hear
          the founders pitch.
        </li>
        <li>
          <strong>2. After the pitch.</strong> You&apos;ll see the deck, DXV&apos;s investment memo and supporting documents, and can tell us if you&apos;re
          interested in investing and roughly how much.
        </li>
        <li>
          <strong>3. Investment.</strong> If the round goes ahead, you&apos;ll see all the documents you need, and confirm your investment.
        </li>
        <li className="text-black/60">
          Deal materials are confidential: please don&apos;t share them. DXV doesn&apos;t give investment advice; every decision is yours, and early-stage
          investing puts all of your money at risk.
        </li>
      </ol>
      {!access && (
        <p className="rounded-md bg-dxv-yellow/30 px-3 py-2 text-sm">
          Deals will appear once you have a current investor statement. You can sign one from your home page at any time.
        </p>
      )}
      <ActionButton run={finishOnboarding} pendingLabel="Opening…">
        Go to my DXV home
      </ActionButton>
    </div>
  );
}
