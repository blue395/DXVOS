import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { saveSyndicateHolding } from "../actions";
import { SyndicateForm } from "../syndicate-form";

export const metadata = { title: "Add a syndicate investment · DXV OS" };

export default async function NewSyndicateHoldingPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/portfolio" className="text-sm text-dxv-green hover:underline">
        ← Portfolio
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Add a syndicate investment</h1>
        <p className="text-sm text-black/60">
          For investments the syndicate made that aren&apos;t tracked as deals in DXV OS, such as earlier rounds. Deals that reach Investment
          Complete appear in the portfolio automatically.
        </p>
      </div>
      <SyndicateForm action={saveSyndicateHolding.bind(null, null)} added submitLabel="Add to the portfolio" />
    </div>
  );
}
