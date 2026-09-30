import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatGbp, investedGbp, isInvestedStage } from "@/lib/pipeline";
import { companyFactsSelect, dxvCompanyFacts } from "@/lib/portfolio";
import { saveSyndicateDealDetails } from "../../actions";
import { SyndicateForm } from "../../syndicate-form";

export const metadata = { title: "Portfolio details · DXV OS" };

/** The team's details on a deal DXV invested in (the amounts come from the deal). */
export default async function SyndicateDealPage({ params }: PageProps<"/portfolio/deal/[ventureId]">) {
  const { ventureId } = await params;
  const v = await requireAdminWith(() =>
    db.venture.findUnique({
      where: { id: ventureId },
      select: {
        id: true,
        name: true,
        currentStage: true,
        investedAmountGbp: true,
        finalInvestments: { where: { removedAt: null }, select: { ticketGbp: true, paidAt: true } },
        syndicateHolding: { include: { updatedBy: { select: { name: true } } } },
        ...companyFactsSelect,
      },
    }),
  );
  if (!v || !isInvestedStage(v.currentStage)) notFound();
  const o = v.syndicateHolding;
  const facts = dxvCompanyFacts(v);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/portfolio" className="text-sm text-dxv-green hover:underline">
        ← Portfolio
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{v.name}</h1>
        <p className="text-sm text-black/60">
          The syndicate invested {formatGbp(investedGbp(v))} (paid tickets on the{" "}
          <Link href={`/deals/${v.id}#final-investment`} className="underline">
            deal page
          </Link>
          ). Add the portfolio details the deal doesn&apos;t hold.
          {o?.updatedBy && ` Last edited by ${o.updatedBy.name} ${formatDateTime(o.updatedAt)}.`}
        </p>
      </div>
      <SyndicateForm
        action={saveSyndicateDealDetails.bind(null, v.id)}
        added={false}
        v={{
          ...(o ?? {}),
          description: o?.description ?? facts.about,
          diversityThemes: o?.diversityThemes.length ? o.diversityThemes : facts.diversityThemes,
        }}
        submitLabel="Save details"
      />
    </div>
  );
}
