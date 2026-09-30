import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/ui";
import { requireAngel } from "@/lib/auth";
import { formatGbp } from "@/lib/pipeline";
import { dxvCompanyFacts, ownsFinalInvestment } from "@/lib/portfolio";
import { saveDxvDetails } from "../../actions";
import { HoldingForm } from "../../holding-form";

export const metadata = { title: "My investment details · DXV Members" };

/** The angel's own details on one of their DXV syndicate investments. */
export default async function DxvHoldingPage({ params }: PageProps<"/portal/portfolio/dxv/[finalId]">) {
  const [{ finalId }, { angel }] = await Promise.all([params, requireAngel()]);
  const f = await ownsFinalInvestment(angel.id, finalId);
  if (!f) notFound();
  const o = f.holding?.angelId === angel.id ? f.holding : null;
  // "About the company" starts from what DXV already has (members' summary or the memo), until they write their own.
  const about = o?.description ?? dxvCompanyFacts(f.venture).about;
  return (
    <div className="space-y-4">
      <Link href="/portal/portfolio" className="text-sm text-dxv-green hover:underline">
        ← My portfolio
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{f.venture.name}</h1>
        <p className="text-sm text-black/65">
          Invested through DXV: {formatGbp(f.ticketGbp)}
          {f.paidAt ? `, paid ${formatDate(f.paidAt)}` : " (payment not yet confirmed)"}. DXV keeps the company, amount and date; add your own details
          below.
        </p>
      </div>
      <HoldingForm action={saveDxvDetails.bind(null, f.id)} outside={false} v={{ ...(o ?? {}), description: about }} submitLabel="Save my details" />
    </div>
  );
}
