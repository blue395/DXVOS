import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { roundOptionCount } from "@/lib/pipeline";
import { NewVentureForm } from "./new-venture-form";

export default async function NewVenturePage() {
  await requireAdmin();
  const { _max } = await db.venture.aggregate({ _max: { round: true } });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/deals" className="text-sm text-dxv-green hover:underline">
        ← Deals
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">New venture</h1>
      <NewVentureForm roundOptions={roundOptionCount(_max.round)} />
    </div>
  );
}
