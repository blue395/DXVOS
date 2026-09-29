import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { unlinkedNames } from "@/lib/angels";
import { suggestAngelMatch } from "@/lib/pipeline";
import { LinkNames } from "./link-client";

export default async function LinkNamesPage() {
  const [names, angels] = await requireAdminWith(() =>
    Promise.all([unlinkedNames(), db.angel.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })]),
  );
  const items = names.map((n) => ({ typed: n.typed, uses: n.uses, suggestion: suggestAngelMatch(n.typed, angels) }));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Link names on votes to angels</h1>
        <p className="text-sm text-black/60">
          Votes and investments recorded before angel records existed hold names as typed (e.g. &ldquo;Kevin W&rdquo;). Link each name to an angel and
          their totals will include those entries. The votes themselves aren&apos;t changed, and a link can be undone from the angel&apos;s page.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dxv-green/30 bg-dxv-green/[0.04] px-4 py-3 text-sm">✓ Every name on votes and investments is linked to an angel.</p>
      ) : angels.length === 0 ? (
        <p className="text-sm">
          Add or import angels first.{" "}
          <Link href="/angels/import" className={buttonClass("secondary")}>
            Import CSV
          </Link>
        </p>
      ) : (
        <LinkNames items={items} angels={angels} />
      )}
    </div>
  );
}
