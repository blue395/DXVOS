import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAngel } from "@/lib/auth";
import { trackPortalView } from "@/lib/portal-analytics";
import { PHASE_STYLE } from "@/lib/board-style";
import { formatDateTime } from "@/components/ui";
import { BOARD_INVOLVEMENT_LABELS, MEMBER_BOARD_STAGES, formatGbpCompact, stagePhase } from "@/lib/pipeline";
import { EoiProgressBar, HowThisWorks, VotingStatus } from "@/components/portal/member-deal-parts";
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
  const [access, { round, cards, updatedAt, voting }] = await Promise.all([
    angelHasDealAccess(angel),
    loadMemberBoard(angel.id),
    trackPortalView(who, "BOARD"),
  ]);
  if (!access) redirect("/portal");
  const open = cards.filter((c) => c.phase).length;
  const voteOpen = cards.some((c) => c.phase && c.column === "PITCH_SELECTION");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-dxv-green">{round !== null ? `Deals: Round ${round}` : "Deals"}</h1>
        <p className="text-sm text-black/60">
          {round !== null
            ? "Every DXV deal in this round appears here. Deals you vote for, say you're interested in, join due diligence on or invest in are highlighted."
            : "DXV hasn't opened a round's board to members yet."}
        </p>
        {round !== null && (
          // Plain status, not chips: the team chooses the round, so there's nothing to switch here.
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {open === 0 ? (
              <span className="text-black/70">No companies are open to you yet: they open from Member Pitch Selection.</span>
            ) : (
              // Plain text (Blue, 2026-10-23): the open cards are highlighted on the board itself.
              <span className="font-semibold text-dxv-green">{open === 1 ? "1 company is open to you" : `${open} companies are open to you`}</span>
            )}
            {updatedAt && <span className="text-xs text-black/50">Last updated {formatDateTime(updatedAt)}</span>}
          </p>
        )}
      </div>

      {round !== null && voteOpen && (
        <div className="rounded-lg border-2 border-dxv-yellow bg-dxv-yellow/10 px-4 py-3 text-sm">
          <p className="font-semibold text-dxv-green">Pre-selection vote: Round {round}</p>
          <p className="mt-0.5 text-black/70">
            Vote for your top {voting.limit}: the {voting.limit} companies with the most votes are invited to pitch. A vote is not a commitment to invest.
          </p>
          <p className="mt-1.5">
            <VotingStatus voting={voting} />
          </p>
        </div>
      )}

      {round !== null && <HowThisWorks />}

      {round !== null && <p className="-mb-2 text-xs text-black/50 xl:hidden">Swipe or scroll sideways to see every stage →</p>}

      {round !== null && (
        // Wider than the portal's reading column, but always inside the window's gutters.
        // Wide screens fit all six columns; narrower ones scroll inside this box (never the page).
        <div className="relative left-1/2 w-[min(100vw-3rem,84rem)] -translate-x-1/2 overflow-x-auto rounded-xl pb-3">
          <div className="flex w-max gap-3 xl:grid xl:w-full xl:grid-cols-6">
            {MEMBER_BOARD_STAGES.map((s) => {
              const col = cards.filter((c) => c.column === s.key);
              const phase = PHASE_STYLE[stagePhase(s.key)];
              const totalRaise = col.reduce((a, c) => a + (c.raiseAmountGbp ?? 0), 0);
              return (
                <div key={s.key} className={`flex w-60 shrink-0 flex-col rounded-xl border xl:w-auto ${phase.column}`}>
                  <div className={`border-b px-3 py-2.5 ${phase.header}`}>
                    <h2 className="flex items-start gap-2 text-sm font-semibold leading-tight text-dxv-green">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${phase.dot}`} />
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <span
                        className="rounded-full bg-white px-1.5 text-xs font-medium text-dxv-green ring-1 ring-dxv-green/20"
                        title="Companies in this column"
                      >
                        {col.length}
                      </span>
                    </h2>
                    <p className="mt-1 pl-[18px] text-[10px] uppercase tracking-wide text-black/45">{phase.label}</p>
                    {totalRaise > 0 && (
                      <p className="mt-0.5 pl-[18px] text-[11px] text-black/55">
                        Total raise <span className="font-mono font-semibold text-dxv-green">{formatGbpCompact(totalRaise)}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                    {col.map((c) => (
                      <BoardCard key={c.id} c={c} />
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

/** A card like the team board's: name and raise, a one-liner written for members, then stage and sector (the round is in the page heading). */
function CardBody({ c, muted = false }: { c: MemberBoardCard; muted?: boolean }) {
  return (
    <>
      <span className={`block font-semibold leading-snug ${muted ? "text-black/75" : "text-black"}`}>{c.name}</span>
      {/* Every card says what it's raising (the round size), or that it's still to be confirmed. */}
      <span className="mt-0.5 block text-xs text-black/60">
        {c.raiseAmountGbp ? (
          <>
            Raising <span className="font-mono font-semibold text-dxv-green">{formatGbpCompact(c.raiseAmountGbp)}</span>
          </>
        ) : (
          "Raise to be confirmed"
        )}
      </span>
      {c.involvement && (
        <span className="mt-1.5 inline-block rounded-full bg-dxv-yellow px-2 py-0.5 text-[11px] font-semibold text-dxv-green">
          ✓ {BOARD_INVOLVEMENT_LABELS[c.involvement]}
        </span>
      )}
      {c.oneLiner && <span className="mt-1 line-clamp-2 block text-xs leading-snug text-black/60">{c.oneLiner}</span>}
      <span className="mt-2 flex flex-wrap gap-1">
        {c.companyStage && <Pill className="bg-white text-black/75 ring-1 ring-black/15">{c.companyStage}</Pill>}
        {c.sector && <Pill className="bg-dxv-green/10 text-dxv-green">{c.sector}</Pill>}
      </span>
    </>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function BoardCard({ c }: { c: MemberBoardCard }) {
  if (c.phase) {
    return (
      <Link
        href={`/portal/deals/${c.id}`}
        className={`block rounded-lg border-2 border-dxv-green p-3 ${c.involvement ? "bg-dxv-yellow/15" : "bg-white"} shadow-sm transition hover:-translate-y-px hover:shadow-md`}
      >
        <CardBody c={c} />
        {c.progress && <EoiProgressBar progress={c.progress} compact />}
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
