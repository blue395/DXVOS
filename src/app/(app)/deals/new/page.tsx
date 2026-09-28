import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NewVentureForm } from "./new-venture-form";

export default async function NewVenturePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/deals" className="text-sm text-dxv-green hover:underline">
        ← Deals
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">New venture</h1>
      <NewVentureForm />
    </div>
  );
}
