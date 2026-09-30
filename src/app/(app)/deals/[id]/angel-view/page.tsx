import Link from "next/link";
import { notFound } from "next/navigation";
import { DealRoomView } from "@/components/portal/deal-room";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadDealRoom } from "@/lib/portal-deals";

/** "Preview as a member": this deal exactly as certified members see it now. Admin only. */
export default async function AngelViewPage({ params, searchParams }: PageProps<"/deals/[id]/angel-view">) {
  const [{ id }, { as }] = await Promise.all([params, searchParams]);
  const asCommitted = as === "committed";
  const [deal, v] = await requireAdminWith(() =>
    Promise.all([loadDealRoom(id, null, { previewCommitted: asCommitted }), db.venture.findUnique({ where: { id }, select: { name: true } })]),
  );
  if (!v) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-dxv-yellow px-3 py-2 text-sm">
        <span>
          <strong>Preview:</strong> {v.name} as {asCommitted ? "members who committed to invest" : "certified members"} see it now.
        </span>
        <Link href={`/deals/${id}#deal-room`} className="font-medium underline">
          Back to the deal
        </Link>
      </div>
      <div className="rounded-lg border-4 border-dashed border-dxv-yellow p-4">
        {deal ? (
          <DealRoomView
            deal={deal}
            docHref={(docId, download) => `/api/documents/${docId}${download ? "?download=1" : ""}`}
            voting={
              deal.voteKind && (
                <p className="rounded-lg border-2 border-dxv-yellow bg-dxv-yellow/10 p-4 text-sm">
                  Members see a form here to record their {deal.voteKind === "pre-selection" ? "pitch selection vote" : "expression of interest (with their maximum ticket)"}.
                </p>
              )
            }
          />
        ) : (
          <p className="text-sm">Members can&apos;t see this deal: it isn&apos;t shared, isn&apos;t at Member Pitch Selection yet, or was declined.</p>
        )}
      </div>
    </div>
  );
}
