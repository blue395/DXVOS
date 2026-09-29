import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AngelImport } from "./import-client";

export default async function ImportAngelsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Import angels from CSV</h1>
        <p className="text-sm text-black/60">
          Match each column in your file to an angel field. DXV OS remembers your choices for files with the same columns, so next month&apos;s export
          imports in one click. Safe to re-run: existing angels are matched by email and never overwritten.
        </p>
      </div>
      <AngelImport />
    </div>
  );
}
