import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DealRoomView } from "@/components/portal/deal-room";
import { requireAngel } from "@/lib/auth";
import { angelHasDealAccess, loadDealRoom } from "@/lib/portal-deals";
import { VotePanel } from "./vote-panel";

export const metadata = { title: "Deal · DXV Members" };

// A deal the team has shared, as the signed-in angel sees it. Anything not shared, not
// yet at a members' stage, or declined is "not found" (its existence isn't revealed).
export default async function PortalDealPage({ params }: PageProps<"/portal/deals/[id]">) {
  const [{ id }, { angel }] = await Promise.all([params, requireAngel()]);
  const [access, deal] = await Promise.all([angelHasDealAccess(angel), loadDealRoom(id, angel.id)]);
  if (!access) redirect("/portal");
  if (!deal) notFound();
  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-dxv-green hover:underline">
        ← Home
      </Link>
      <DealRoomView
        deal={deal}
        docHref={(docId, download) => `/api/portal/documents/${docId}${download ? "?download=1" : ""}`}
        voting={<VotePanel deal={deal} />}
      />
    </div>
  );
}
