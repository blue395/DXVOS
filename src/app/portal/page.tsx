import { redirect } from "next/navigation";
import { PortalHome } from "@/components/portal/portal-home";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { latestCertification, nextOnboardingStep } from "@/lib/pipeline";
import { angelHasDealAccess, currentMemberRound, listSharedDeals } from "@/lib/portal-deals";

export const metadata = { title: "DXV Members" };

export default async function PortalHomePage() {
  const { angel } = await requireAngel();
  const [certs, access, deals, boardRound] = await Promise.all([
    db.angelCertification.findMany({ where: { angelId: angel.id }, select: { type: true, signedOn: true, expiresOn: true } }),
    angelHasDealAccess(angel),
    listSharedDeals(angel.id),
    currentMemberRound(),
  ]);
  const cert = latestCertification(certs);
  const step = nextOnboardingStep(angel, cert);
  if (step !== "done") redirect(`/portal/${step}`);
  return <PortalHome angel={angel} cert={cert} deals={access ? deals : []} boardRound={boardRound} />;
}
