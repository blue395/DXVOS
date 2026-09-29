import Link from "next/link";
import { formatDate } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { loadAngelRows } from "@/lib/angels";
import { findDuplicateAngels, formatGbp } from "@/lib/pipeline";
import { AngelStatusBadge, CertBadge } from "../badges";
import { ArchiveAngelButton } from "../[id]/angel-client";

export default async function DuplicatesPage() {
  const rows = await requireAdminWith(() => loadAngelRows());
  const groups = findDuplicateAngels(rows);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Possible duplicates</h1>
        <p className="text-sm text-black/60">
          Angels sharing an email or a name. Keep the fuller record and archive the other (archived angels are hidden, never deleted). Move anything
          worth keeping (notes, certifications) across first.
        </p>
      </div>
      {groups.length === 0 && <p className="rounded-lg border border-dxv-green/30 bg-dxv-green/[0.04] px-4 py-3 text-sm">✓ No duplicates found.</p>}
      {groups.map((g, gi) => (
        <ul key={gi} className="divide-y divide-black/5 rounded-lg border border-black/10 bg-white">
          {g.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="space-y-0.5">
                <Link href={`/angels/${a.id}`} className="font-medium hover:text-dxv-green hover:underline">
                  {a.name}
                </Link>
                <span className="block text-xs text-black/50">
                  {a.email ?? "no email"}
                  {a.joinedAt && ` · member since ${formatDate(a.joinedAt)}`}
                  {a.committedGbp > 0 && ` · committed ${formatGbp(a.committedGbp)}`}
                </span>
                <span className="flex gap-1.5">
                  <AngelStatusBadge status={a.status} />
                  <CertBadge state={a.certState} expiresOn={a.cert?.expiresOn} member={a.status === "MEMBER"} />
                </span>
              </span>
              <ArchiveAngelButton angelId={a.id} archived={false} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
