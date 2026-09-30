import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSyndicateHolding } from "../actions";
import { RemoveSyndicateButton } from "../remove-button";
import { SyndicateForm } from "../syndicate-form";

export const metadata = { title: "Edit syndicate investment · DXV OS" };

export default async function EditSyndicateHoldingPage({ params }: PageProps<"/portfolio/[id]">) {
  const { id } = await params;
  const h = await requireAdminWith(() =>
    db.syndicateHolding.findFirst({
      where: { id, ventureId: null, archivedAt: null },
      include: { createdBy: { select: { name: true } }, updatedBy: { select: { name: true } } },
    }),
  );
  if (!h) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/portfolio" className="text-sm text-dxv-green hover:underline">
        ← Portfolio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">{h.companyName}</h1>
          <p className="text-xs text-black/50">
            Added by {h.createdBy.name} {formatDateTime(h.createdAt)}
            {h.updatedBy && ` · last edited by ${h.updatedBy.name} ${formatDateTime(h.updatedAt)}`}
          </p>
        </div>
        <RemoveSyndicateButton holdingId={h.id} company={h.companyName ?? "this investment"} />
      </div>
      <SyndicateForm action={saveSyndicateHolding.bind(null, h.id)} added v={h} submitLabel="Save" />
    </div>
  );
}
