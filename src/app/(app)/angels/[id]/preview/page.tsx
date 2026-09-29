import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalHome } from "@/components/portal/portal-home";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { latestCertification } from "@/lib/pipeline";
import { angelHasDealAccess, listSharedDeals } from "@/lib/portal-deals";

/** "View as angel": the portal home exactly as this angel sees it (spec §4). Admin only. */
export default async function PreviewPage({ params }: PageProps<"/angels/[id]/preview">) {
  const { id } = await params;
  const [angel, deals] = await requireAdminWith(() =>
    Promise.all([
      db.angel.findUnique({ where: { id }, include: { certifications: { select: { type: true, signedOn: true, expiresOn: true } } } }),
      listSharedDeals(),
    ]),
  );
  if (!angel) notFound();
  const access = await angelHasDealAccess(angel);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-dxv-yellow px-3 py-2 text-sm">
        <span>
          <strong>Preview:</strong> this is what {angel.name} sees on their portal home. Buttons are hidden.
        </span>
        <Link href={`/angels/${angel.id}`} className="font-medium underline">
          Back to {angel.name}
        </Link>
      </div>
      <div className="rounded-lg border-4 border-dashed border-dxv-yellow p-4">
        <PortalHome
          angel={angel}
          cert={latestCertification(angel.certifications)}
          deals={access ? deals : []}
          dealHref={(dealId) => `/deals/${dealId}/angel-view`}
          preview
        />
      </div>
    </div>
  );
}
