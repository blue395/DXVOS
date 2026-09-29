import { redirect } from "next/navigation";
import { PortalHome } from "@/components/portal/portal-home";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { latestCertification, nextOnboardingStep } from "@/lib/pipeline";

export const metadata = { title: "DXV Members" };

export default async function PortalHomePage() {
  const { angel } = await requireAngel();
  const certs = await db.angelCertification.findMany({ where: { angelId: angel.id }, select: { type: true, signedOn: true, expiresOn: true } });
  const cert = latestCertification(certs);
  const step = nextOnboardingStep(angel, cert);
  if (step !== "done") redirect(`/portal/${step}`);
  return <PortalHome angel={angel} cert={cert} />;
}
