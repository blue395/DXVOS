import Link from "next/link";
import { Card, formatDateTime } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { impactThemeOptions } from "@/lib/pipeline";
import { currentPlaybook } from "@/lib/playbook/current";
import { approvalProblems, packName } from "@/lib/opportunities/build";
import type { OpportunityContent } from "@/lib/opportunities/schema";
import { LogoForm } from "./logo-form";
import { ApprovePackButton, GeneratePackButton, RevisePackButton } from "./pack-buttons";
import { PackEditor } from "./pack-editor";

export const metadata = { title: "Opportunities pack · DXV OS" };

// Members' opportunities pack: branded slides on every deal at Member Pitch Selection in a
// round. Drafted with AI, edited and approved by the partners; only approved packs reach
// members (portal download, email attachment).
export default async function OpportunitiesPage({ searchParams }: PageProps<"/deals/opportunities">) {
  const sp = await searchParams;
  const [ventures, packs, memberRound, playbook] = await requireAdminWith(() =>
    Promise.all([
      db.venture.findMany({
        where: { round: { not: null }, currentStage: "PITCH_SELECTION" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          round: true,
          sharedWithAngelsAt: true,
          logos: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      }),
      db.opportunityPack.findMany({
        orderBy: [{ round: "desc" }, { number: "desc" }],
        select: {
          id: true,
          round: true,
          number: true,
          title: true,
          status: true,
          error: true,
          content: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          editedAt: true,
          approvedAt: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      }),
      db.memberRound.findFirst({ orderBy: { createdAt: "desc" }, select: { round: true } }),
      currentPlaybook("ASSESSMENT"),
    ]),
  );
  const rounds = [...new Set([...ventures.map((v) => v.round!), ...packs.map((p) => p.round)])].sort((a, b) => b - a);
  const asked = Number(sp.round);
  const open = memberRound?.round ?? null;
  const round = rounds.includes(asked) ? asked : open !== null && rounds.includes(open) ? open : (rounds[0] ?? null);
  const inRound = ventures.filter((v) => v.round === round);
  const versions = packs.filter((p) => p.round === round).map((p) => ({ ...p, effective: effectiveDeckStatus(p) }));
  const running = versions.some((p) => p.effective.status === "PENDING" || p.effective.status === "PROCESSING");
  const picked = versions.find((p) => p.number === Number(sp.v)) ?? versions[0] ?? null;
  const base = (r: number | null, v?: number) => `/deals/opportunities?round=${r}${v ? `&v=${v}` : ""}`;
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-dxv-green bg-dxv-green text-white" : "border-dxv-green/30 text-dxv-green hover:bg-dxv-green/5"}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div>
        <Link href="/deals" className="text-sm text-dxv-green hover:underline">
          ← Deals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-dxv-green">Opportunities pack</h1>
        <p className="text-sm text-black/60">
          Branded slides on every deal at Member Pitch Selection in a round, for DXV&apos;s certified members. Draft with AI, edit, preview the PDF, then
          approve: members can download the approved pack from their deals board, and you can attach it to an email (Angels → Email angels).
        </p>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <p className="text-sm text-black/60">No deals with a round are at Member Pitch Selection yet.</p>
        </Card>
      ) : (
        <>
          <nav aria-label="Rounds" className="flex flex-wrap gap-2">
            {rounds.map((r) => (
              <Link key={r} href={base(r)} aria-current={r === round ? "page" : undefined} className={pill(r === round)}>
                Round {r} <span className={r === round ? "text-dxv-yellow" : "text-black/45"}>{ventures.filter((v) => v.round === r).length}</span>
              </Link>
            ))}
          </nav>

          <Card
            title={`Round ${round}: ${inRound.length} deal${inRound.length === 1 ? "" : "s"} at Member Pitch Selection`}
            actions={round !== null && inRound.length > 0 && !running ? <GeneratePackButton round={round} again={versions.length > 0} /> : undefined}
          >
            {inRound.length === 0 ? (
              <p className="text-sm text-black/60">No deals in this round are at Member Pitch Selection right now.</p>
            ) : (
              <>
                <p className="text-xs text-black/55">
                  The AI drafts each slide from the deck and the issued memo (usually 1 to 3 minutes). Logos are used on every version; upload or replace them
                  here.
                </p>
                <ul className="mt-2 divide-y divide-black/10">
                  {inRound.map((v) => (
                    <LogoForm key={v.id} ventureId={v.id} name={v.name} hasLogo={v.logos.length > 0} version={v.logos[0]?.createdAt.getTime() ?? 0} />
                  ))}
                </ul>
                {inRound.some((v) => !v.sharedWithAngelsAt) && (
                  <p className="mt-2 rounded bg-dxv-yellow/30 px-3 py-2 text-sm">
                    Not shared with members yet:{" "}
                    {inRound
                      .filter((v) => !v.sharedWithAngelsAt)
                      .map((v) => v.name)
                      .join(", ")}
                    . Share them on the deal page before approving the pack.
                  </p>
                )}
              </>
            )}
            {running && (
              <p className="mt-2 flex items-center gap-2 text-sm text-dxv-green" aria-live="polite">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
                Drafting the slides… progress is in the corner; this page updates when it&apos;s done.
              </p>
            )}
          </Card>

          {versions.length > 0 && (
            <nav aria-label="Pack versions" className="flex flex-wrap gap-2">
              {versions.map((p) => (
                <Link key={p.id} href={base(round, p.number)} aria-current={p.id === picked?.id ? "page" : undefined} className={pill(p.id === picked?.id)}>
                  {packName(p.number)}
                  {p.approvedAt ? " ✓ approved" : p.effective.status === "FAILED" ? " (failed)" : p.effective.status === "COMPLETE" ? "" : " (drafting…)"}
                </Link>
              ))}
            </nav>
          )}

          {picked?.effective.status === "FAILED" && (
            <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
              {packName(picked.number)} failed: {picked.effective.error}
            </p>
          )}

          {picked?.effective.status === "COMPLETE" &&
            picked.content &&
            (() => {
              const c = picked.content as OpportunityContent;
              const problems = approvalProblems(c, new Set(ventures.filter((v) => v.sharedWithAngelsAt).map((v) => v.id)));
              return (
                <>
                  <Card
                    title={`${packName(picked.number)}: ${c.title}`}
                    actions={
                      <span className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/opportunities/${picked.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-dxv-green/40 px-3 py-1.5 text-sm font-medium text-dxv-green hover:bg-dxv-green/5"
                        >
                          {picked.approvedAt ? "View PDF" : "Preview PDF"}
                        </a>
                        <a href={`/api/opportunities/${picked.id}/pdf?download=1`} className="text-sm text-dxv-green underline">
                          Download
                        </a>
                      </span>
                    }
                  >
                    <div className="space-y-3 text-sm">
                      {picked.approvedAt ? (
                        <p className="rounded-md bg-dxv-green px-3 py-2 text-white">
                          ✓ Approved for members by {picked.approvedBy?.name}, {formatDateTime(picked.approvedAt)}. Locked: members with a current investor
                          statement can download it from their deals board, and it can be attached to emails.
                        </p>
                      ) : (
                        <p role="note" className="rounded-md border-2 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-dxv-green">
                          <strong>Draft: not for members yet.</strong> Every slide says so until a partner approves it. Check the PDF, edit below, then approve.
                        </p>
                      )}
                      <p className="text-xs text-black/50">
                        Drafted by {picked.createdBy.name}, {formatDateTime(picked.completedAt ?? picked.createdAt)}
                        {picked.updatedBy && picked.editedAt ? ` · last edited by ${picked.updatedBy.name}, ${formatDateTime(picked.editedAt)}` : ""}.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!picked.approvedAt && problems.length === 0 && <ApprovePackButton id={picked.id} />}
                        <RevisePackButton id={picked.id} />
                      </div>
                      {!picked.approvedAt && problems.length > 0 && (
                        <ul className="list-disc space-y-0.5 rounded bg-dxv-yellow/30 py-2 pl-7 pr-3">
                          {problems.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                  {!picked.approvedAt && (
                    <PackEditor
                      id={picked.id}
                      version={picked.editedAt?.toISOString() ?? ""}
                      content={c}
                      themes={impactThemeOptions(playbook.content.impactThemes)}
                    />
                  )}
                </>
              );
            })()}
        </>
      )}
    </div>
  );
}
