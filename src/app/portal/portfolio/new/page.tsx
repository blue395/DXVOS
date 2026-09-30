import Link from "next/link";
import { requireAngel } from "@/lib/auth";
import { saveOutsideHolding } from "../actions";
import { HoldingForm } from "../holding-form";

export const metadata = { title: "Add an investment · DXV Members" };

export default async function NewHoldingPage() {
  await requireAngel();
  return (
    <div className="space-y-4">
      <Link href="/portal/portfolio" className="text-sm text-dxv-green hover:underline">
        ← My portfolio
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Add an investment</h1>
        <p className="text-sm text-black/65">
          An investment you made outside DXV: directly, or through another syndicate or platform. Only the company and amount are needed; add the
          rest whenever you have it. Your DXV investments appear automatically.
        </p>
      </div>
      <HoldingForm action={saveOutsideHolding.bind(null, null)} outside submitLabel="Add to my portfolio" />
    </div>
  );
}
