import Link from "next/link";
import { redirect } from "next/navigation";
import { PhaseBadge } from "@/components/portal/deal-room";
import { requireAngel } from "@/lib/auth";
import { BOARD_STAGES, stageLabel } from "@/lib/pipeline";
import { angelHasDealAccess, loadMemberBoard } from "@/lib/portal-deals";

export const metadata = { title: "Deals board · DXV Members" };

/**
 * The members' deals board: read-only, the round DXV has opened to members. Every card
 * shows the company name and sector; a card opens into its deal room only once the deal
 * is at Member Pitch Selection or later and DXV has shared it.
 */
export default async function MemberBoardPage() {
  const { angel } = await requireAngel();
  const [access, { round, cards }] = await Promise.all([angelHasDealAccess(angel), loadMemberBoard()]);
  if (!access) redirect("/portal");
  const open = cards.filter((c) => c.phase).length;

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-dxv-green hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{round !== null ? `Round ${round} deals` : "Deals board"}</h1>
        <p className="text-sm text-black/65">
          {round !== null
            ? "Where each company in this round is in DXV's process. Companies open to you once they reach Member Pitch Selection: click a highlighted card to read its deck and documents and vote."
            : "DXV hasn't opened a round's board to members yet."}
        </p>
        {round !== null && (
          <p className="mt-2 inline-block rounded bg-dxv-yellow px-2 py-0.5 text-sm font-medium text-dxv-green">
            {open === 0 ? "No companies open to you yet" : `${open} ${open === 1 ? "company is" : "companies are"} open to you`}
          </p>
        )}
      </div>
      {round !== null && (
        // Full width (wider than the portal's reading column), so every stage fits on a laptop screen.
        <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto px-4 pb-2">
          {/* w-max + mx-auto: centred when it fits, scrolls from the first column when it doesn't */}
          <div className="mx-auto flex w-max gap-2">
          {BOARD_STAGES.map((s) => {
            const col = cards.filter((c) => c.column === s.key);
            return (
              <div key={s.key} className="w-40 shrink-0 rounded-lg bg-black/[0.03] p-2">
                <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-dxv-green">
                  <span className="truncate">{stageLabel(s.key)}</span>
                  <span className="text-black/45">{col.length}</span>
                </h2>
                <ul className="space-y-2">
                  {col.map((c) =>
                    c.phase ? (
                      <li key={c.id}>
                        <Link
                          href={`/portal/deals/${c.id}`}
                          className="block rounded-md border-2 border-dxv-green bg-white p-2.5 text-sm shadow-sm transition hover:-translate-y-px hover:shadow"
                        >
                          <span className="block font-semibold text-dxv-green">{c.name}</span>
                          {c.sector && <span className="block text-xs text-black/55">{c.sector}</span>}
                          <span className="mt-1.5 block">
                            <PhaseBadge phase={c.phase} />
                          </span>
                          <span className="mt-1.5 block text-xs font-semibold text-dxv-green">Open deal →</span>
                        </Link>
                      </li>
                    ) : (
                      <li key={c.id} className="rounded-md border border-black/10 bg-white p-2.5 text-sm" title="Details open from Member Pitch Selection">
                        <span className="block font-medium text-black/75">{c.name}</span>
                        {c.sector && <span className="block text-xs text-black/50">{c.sector}</span>}
                        <span className="mt-1 block text-[11px] text-black/45">
                          {BOARD_STAGES.findIndex((b) => b.key === c.column) < BOARD_STAGES.findIndex((b) => b.key === "PITCH_SELECTION")
                            ? "Details from Member Pitch Selection"
                            : "Not open to members yet"}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
