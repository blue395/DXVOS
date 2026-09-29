import { OnboardingStepper } from "@/components/portal/stepper";
import { formatDate } from "@/components/ui";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { CERTIFICATION_LABELS, certState, latestCertification } from "@/lib/pipeline";
import { SignStatementForm } from "./sign-form";

export const metadata = { title: "Investor statement · DXV Members" };

export default async function CertifyPage() {
  const { angel } = await requireAngel();
  const [statements, certs] = await Promise.all([
    db.complianceText.findMany({
      where: { status: "APPROVED", kind: { in: ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT"] } },
      orderBy: { kind: "asc" },
      select: { id: true, kind: true, title: true, body: true, criteria: true },
    }),
    db.angelCertification.findMany({ where: { angelId: angel.id }, select: { type: true, signedOn: true, expiresOn: true } }),
  ]);
  const cert = latestCertification(certs);
  const state = certState(cert);

  return (
    <div className="space-y-4">
      {!angel.onboardedAt && <OnboardingStepper current="certify" />}
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Your investor statement</h1>
        <p className="text-sm text-black/60">
          UK financial promotion rules let DXV share investment opportunities only with people who are high net worth or sophisticated investors, and who
          have signed a statement saying so in the last 12 months. It takes a couple of minutes, and you&apos;ll renew it once a year.
        </p>
      </div>
      {cert && (state === "current" || state === "due-soon") && (
        <p className="rounded-md bg-dxv-green/10 px-3 py-2 text-sm text-dxv-green">
          Your current statement ({CERTIFICATION_LABELS[cert.type]}) is valid until {formatDate(cert.expiresOn)}. Signing again renews it from today.
        </p>
      )}
      {statements.length < 2 ? (
        <p className="rounded-md bg-dxv-yellow/30 px-3 py-2 text-sm">Statements are being updated just now. Please come back later.</p>
      ) : (
        <SignStatementForm statements={statements} name={angel.name} />
      )}
    </div>
  );
}
