import Link from "next/link";
import { buttonClass, formatDate } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { aliasMap, loadAngelRows, unlinkedNames } from "@/lib/angels";
import { findDuplicateAngels, formatGbpCompact, matchesAngelFilter, parseAngelFilter, type AngelFilter } from "@/lib/pipeline";
import { AngelStatusBadge, CertBadge, Chips } from "../badges";
import { CopyEmailsButton } from "../copy-emails";

const FILTERS: { key: AngelFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "members", label: "Members" },
  { key: "prospects", label: "Prospects" },
  { key: "action", label: "Certification needed" },
  { key: "due-soon", label: "Due in 30 days" },
  { key: "lapsed", label: "Lapsed" },
];

export default async function AngelsPage({ searchParams }: PageProps<"/angels">) {
  const params = await searchParams;
  const filter = parseAngelFilter(params.filter);
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const archived = params.archived === "1";

  const [rows, unlinked] = await requireAdminWith(async () => {
    const aliases = await aliasMap();
    return Promise.all([loadAngelRows({ archived }), unlinkedNames(aliases)]);
  });

  const members = rows.filter((r) => r.status === "MEMBER");
  const needsAction = rows.filter((r) => r.needsAction).length;
  const dueSoon = members.filter((r) => r.certState === "due-soon").length;
  const womenMembers = members.filter((r) => r.tags.some((t) => t.toLowerCase() === "woman angel")).length;
  const duplicates = findDuplicateAngels(rows).length;
  const count = (f: AngelFilter) => rows.filter((r) => matchesAngelFilter(f, r.status, r.certState)).length;

  const needle = q.toLowerCase();
  const shown = rows.filter(
    (r) =>
      matchesAngelFilter(filter, r.status, r.certState) &&
      (!needle || [r.name, r.email ?? "", r.location ?? "", ...r.sectors, ...r.tags].some((v) => v.toLowerCase().includes(needle))),
  );
  const href = (f: AngelFilter) => {
    const p = new URLSearchParams();
    if (f !== "all") p.set("filter", f);
    if (q) p.set("q", q);
    if (archived) p.set("archived", "1");
    const s = p.toString();
    return s ? `/angels?${s}` : "/angels";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Angels{archived && " (archived)"}</h1>
          <p className="text-sm text-black/60">
            DXV&apos;s members and prospects, their investor certification and what they&apos;ve committed. Admin only for now.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/angels/statements" className={buttonClass("secondary")}>
            Statements &amp; terms
          </Link>
          <Link href="/angels/import" className={buttonClass("secondary")}>
            Import CSV
          </Link>
          <a href={`/api/angels/export${archived ? "?archived=1" : ""}`} className={buttonClass("secondary")}>
            Export CSV
          </a>
          <Link href="/angels/emails" className={buttonClass("secondary")}>
            Email angels
          </Link>
          <Link href="/angels/new" className={buttonClass("secondary")}>
            + Add angel
          </Link>
          <Link href="/angels/invite" className={buttonClass("accent")}>
            Invite an angel
          </Link>
        </div>
      </div>

      {!archived && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Members" value={members.length} href={href("members")} />
          <Stat
            label="Certification needed"
            value={needsAction}
            href={href("action")}
            alarm={needsAction > 0}
            note={needsAction ? "Members without a current statement" : "Every member is certified"}
          />
          <Stat label="Due in 30 days" value={dueSoon} href={href("due-soon")} note="Statements expiring soon" />
          <Stat label="Prospects" value={count("prospects")} href={href("prospects")} note="Being recruited" />
          <Stat label="Women members" value={womenMembers} note="Self-declared (Woman angel tag)" />
        </div>
      )}

      {(unlinked.length > 0 || duplicates > 0) && !archived && (
        <div className="flex flex-wrap gap-2 text-sm">
          {unlinked.length > 0 && (
            <Link href="/angels/link" className="rounded-md bg-dxv-yellow/30 px-3 py-1.5 text-black hover:bg-dxv-yellow/50">
              <strong>{unlinked.length}</strong> name{unlinked.length === 1 ? "" : "s"} on votes and investments not linked to an angel yet: review →
            </Link>
          )}
          {duplicates > 0 && (
            <Link href="/angels/duplicates" className="rounded-md bg-dxv-yellow/30 px-3 py-1.5 text-black hover:bg-dxv-yellow/50">
              <strong>{duplicates}</strong> possible duplicate{duplicates === 1 ? "" : "s"}: review →
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter angels" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key)}
              aria-current={filter === f.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                filter === f.key ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"
              }`}
            >
              {f.label} <span className="opacity-60">{count(f.key)}</span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/angels" className="flex">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {archived && <input type="hidden" name="archived" value="1" />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, sector, tag…"
              aria-label="Search angels"
              className="w-60 rounded-md border border-black/20 px-2.5 py-1.5 text-sm focus:border-dxv-green focus:outline-none"
            />
          </form>
          <CopyEmailsButton emails={shown.flatMap((r) => (r.email ? [r.email] : []))} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-dxv-green/[0.03] text-left text-xs uppercase tracking-wide text-black/55">
            <tr>
              <th className="px-3 py-2 font-medium">Angel</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Sectors</th>
              <th className="px-3 py-2 font-medium">Certification</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell" title="Latest EOI per deal, where interested">
                Committed
              </th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell" title="Paid final investment tickets">
                Invested
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {shown.map((r) => (
              <tr key={r.id} className="transition hover:bg-dxv-green/[0.03]">
                <td className="px-3 py-2">
                  <Link href={`/angels/${r.id}`} className="font-medium text-black hover:text-dxv-green hover:underline">
                    {r.name}
                  </Link>
                  <span className="block text-xs text-black/50">{[r.email, r.location].filter(Boolean).join(" · ") || "No contact details"}</span>
                  {r.tags.length > 0 && (
                    <span className="mt-1 block">
                      <Chips items={r.tags} className="bg-dxv-yellow/40 text-black/80" />
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <AngelStatusBadge status={r.status} />
                  {r.joinedAt && r.status === "MEMBER" && <span className="block text-[11px] text-black/45">since {formatDate(r.joinedAt)}</span>}
                </td>
                <td className="hidden max-w-56 px-3 py-2 align-top md:table-cell">
                  <Chips items={r.sectors} />
                </td>
                <td className="px-3 py-2 align-top">
                  <CertBadge state={r.certState} expiresOn={r.cert?.expiresOn} member={r.status === "MEMBER"} />
                </td>
                <td className="hidden px-3 py-2 text-right align-top font-mono text-xs tabular-nums md:table-cell">{r.committedGbp ? formatGbpCompact(r.committedGbp) : "–"}</td>
                <td className="hidden px-3 py-2 text-right align-top font-mono text-xs font-semibold tabular-nums text-dxv-green md:table-cell">
                  {r.investedGbp ? formatGbpCompact(r.investedGbp) : "–"}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-black/55">
                  {rows.length === 0 ? (
                    <>
                      No angels yet. <Link href="/angels/import" className="font-medium text-dxv-green underline">Import your Squarespace CSV</Link> or{" "}
                      <Link href="/angels/new" className="font-medium text-dxv-green underline">add one</Link>.
                    </>
                  ) : (
                    "No angels match."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-black/45">
        {archived ? (
          <Link href="/angels" className="underline">
            Back to angels
          </Link>
        ) : (
          <Link href="/angels?archived=1" className="underline">
            Archived angels
          </Link>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value, note, href, alarm }: { label: string; value: number; note?: string; href?: string; alarm?: boolean }) {
  const body = (
    <>
      <p className={`text-xs font-medium uppercase tracking-wide ${alarm ? "text-black" : "text-black/55"}`}>{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alarm ? "text-black" : "text-dxv-green"}`}>{value}</p>
      {note && <p className={`mt-1 text-[11px] ${alarm ? "text-black/75" : "text-black/45"}`}>{note}</p>}
    </>
  );
  const cls = `rounded-lg border px-4 py-3 ${alarm ? "border-black/30 bg-dxv-yellow" : "border-black/10 bg-white"}`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-dxv-green/50 hover:shadow-sm`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
