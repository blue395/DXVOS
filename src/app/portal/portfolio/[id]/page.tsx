import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveOutsideHolding } from "../actions";
import { RemoveHoldingButton } from "../remove-button";
import { HoldingForm } from "../holding-form";

export const metadata = { title: "Edit investment · DXV Members" };

export default async function EditHoldingPage({ params }: PageProps<"/portal/portfolio/[id]">) {
  const [{ id }, { angel }] = await Promise.all([params, requireAngel()]);
  // Only this angel's own outside investments.
  const h = await db.portfolioHolding.findFirst({ where: { id, angelId: angel.id, finalInvestmentId: null, archivedAt: null } });
  if (!h) notFound();
  return (
    <div className="space-y-4">
      <Link href="/portal/portfolio" className="text-sm text-dxv-green hover:underline">
        ← My portfolio
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-dxv-green">{h.companyName}</h1>
        <RemoveHoldingButton holdingId={h.id} company={h.companyName ?? "this investment"} />
      </div>
      <HoldingForm action={saveOutsideHolding.bind(null, h.id)} outside v={h} submitLabel="Save" />
    </div>
  );
}
