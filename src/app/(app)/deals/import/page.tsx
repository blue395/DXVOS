import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { DealImport } from "./import-client";

export const metadata = { title: "Import declined deals · DXV OS" };

export default async function ImportDealsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/deals?declined=1" className="text-sm text-dxv-green hover:underline">
        ← Declined deals
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Import declined deals</h1>
        <p className="text-sm text-black/60">
          Bring in the deals DXV declined before DXV OS, so the whole dealflow record is in one place for analysis (ask DXV Brain, for example,
          &ldquo;why have we declined deals, by year?&rdquo;). They go straight into Declined, keep their original dates, and are marked as
          imported. Companies already in DXV OS are skipped, so it&apos;s safe to re-run.
        </p>
        <p className="mt-2 text-sm text-black/60">
          Useful columns: company name (required), founder, email, website, sector, company stage, raise amount, date received, date declined, the
          stage it was declined at, the reason, and notes.
        </p>
      </div>
      <DealImport />
    </div>
  );
}
