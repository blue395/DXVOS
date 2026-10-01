import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAngel } from "@/lib/auth";
import { trackPortalView } from "@/lib/portal-analytics";
import { PHASE_STYLE } from "@/lib/board-style";
import { MEMBER_BOARD_STAGES, formatGbpCompact, stagePhase } from "@/lib/pipeline";
import { angelHasDealAccess, loadMemberBoard, type MemberBoardCard } from "@/lib/portal-deals";

export const metadata = { title: "Deals board · DXV Members" };

const PITCH_SELECTION_INDEX = MEMBER_BOARD_STAGES.findIndex((b) => b.key === "PITCH_SELECTION");

/**
 * The members' deals board, in the same style as the team's board: read-only, the round
 * DXV has opened to members. Every card shows the company name and sector; a card opens
 * into its deal room only once the deal is at Member Pitch Selection or later and DXV has
 * shared it.
 */
export default async function MemberBoardPage() {
  const who = await requireAngel();
  const { angel } = who;
  const [access, { round, cards }] = await Promise.all([angelHasDealAccess(angel), loadMemberBoard(), trackPortalView(who, "BOARD")]);
  if (!access) redirect("/portal");
  const open = cards.filter((c) => c.phase).length;
  // The first open card in board order, for the "open to you" jump link.
  const firstOpenId = MEMBER_BOARD_STAGES.flatMap((s) => cards.filter((c) => c.column === s.key && c.phase))[0]?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Deals</h1>
          <p className="text-sm text-black/60">
            {round !== null
              ? "Where each company in this round is in DXV's process. Companies open to you from Member Pitch Selection: click a highlighted card to read its deck and documents and vote."
              : "DXV hasn't opened a round's board to members yet."}
          </p>
        </div>
        {round !== null && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-dxv-green px-3 py-1 font-medium text-white">Round {round}</span>
            {open === 0 ? (
              <span className="rounded-full bg-dxv-yellow px-3 py-1 font-medium text-dxv-green">None open to you yet</span>
            ) : (
              <a href="#open-deal" className="rounded-full bg-dxv-yellow px-3 py-1 font-medium text-dxv-green transition hover:bg-dxv-yellow/80" title="Jump to it on the board">
                {open} open to you →
              </a>
            )}
          </div>
        )}
      </div>

      {round !== null && (
        // Full width (wider than the portal's reading column), like the team board.
        <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto px-4 pb-4">
          <div className="mx-auto flex w-max gap-3">
            {MEMBER_BOARD_STAGES.map((s) => {
              const col = cards.filter((c) => c.column === s.key);
              const phase = PHASE_STYLE[stagePhase(s.key)];
              const totalRaise = col.reduce((a, c) => a + (c.raiseAmountGbp ?? 0), 0);
              return (
                <div key={s.key} className={`flex w-56 shrink-0 flex-col rounded-xl border ${phase.column}`}>
                  <div className={`border-b px-3 py-2.5 ${phase.header}`}>
                    <h2 className="flex items-center gap-2 text-sm font-semibold leading-tight text-dxv-green">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${phase.dot}`} />
                      <span className="min-w-0 flex-1 truncate" title={s.label}>
                        {s.label}
                      </span>
                      <span className="rounded-full bg-white px-1.5 text-xs font-medium text-dxv-green ring-1 ring-dxv-green/20">{col.length}</span>
                      {totalRaise > 0 && (
                        <span className="font-mono text-xs font-normal text-black/55" title="Total raise of the companies in this column">
                          {formatGbpCompact(totalRaise)}
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 pl-[18px] text-[10px] uppercase tracking-wide text-black/45">{phase.label}</p>
                  </div>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                    {col.map((c) => (
                      <BoardCard key={c.id} c={c} anchor={c.id === firstOpenId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** A card like the team board's: name and raise, a one-liner written for members, then stage, sector and round. */
function CardBody({ c, muted = false }: { c: MemberBoardCard; muted?: boolean }) {
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className={`font-semibold leading-snug ${muted ? "text-black/75" : "text-black"}`}>{c.name}</span>
        {c.raiseAmountGbp ? (
          <span className="shrink-0 font-mono text-xs font-semibold text-dxv-green" title="Raising">
            {formatGbpCompact(c.raiseAmountGbp)}
          </span>
        ) : null}
      </span>
      {c.oneLiner && <span className="mt-1 line-clamp-2 block text-xs leading-snug text-black/60">{c.oneLiner}</span>}
      <span className="mt-2 flex flex-wrap gap-1">
        {c.companyStage && <Pill className="bg-white text-black/75 ring-1 ring-black/15">{c.companyStage}</Pill>}
        {c.sector && <Pill className="bg-dxv-green/10 text-dxv-green">{c.sector}</Pill>}
        {c.round && <Pill className="bg-dxv-yellow text-dxv-green">Round {c.round}</Pill>}
      </span>
    </>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function BoardCard({ c, anchor }: { c: MemberBoardCard; anchor: boolean }) {
  if (c.phase) {
    return (
      <Link
        id={anchor ? "open-deal" : undefined}
        href={`/portal/deals/${c.id}`}
        className="block scroll-mx-8 scroll-mt-20 rounded-lg border-2 border-dxv-green bg-white p-3 shadow-sm transition hover:-translate-y-px hover:shadow-md"
      >
        <CardBody c={c} />
        <span className="mt-2.5 block border-t border-black/5 pt-2 text-right text-xs font-semibold text-dxv-green">View deal →</span>
      </Link>
    );
  }
  const before = MEMBER_BOARD_STAGES.findIndex((b) => b.key === c.column) < PITCH_SELECTION_INDEX;
  return (
    <div className="rounded-lg border border-black/10 bg-white/80 p-3 shadow-sm" title="Details open from Member Pitch Selection">
      <CardBody c={c} muted />
      <span className="mt-2.5 block border-t border-black/5 pt-2 text-[11px] text-black/45">
        {before ? "Deck and details from Member Pitch Selection" : "Not open to members yet"}
      </span>
    </div>
  );
}
