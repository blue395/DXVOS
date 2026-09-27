import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  GATE_LABELS,
  MOMENTUM_THRESHOLD_GBP,
  PASS_REASON_LABELS,
  daysSince,
  dealWarnings,
  eoiSummary,
  formatGbp,
  latestVotePerAngel,
  stageLabel,
} from "@/lib/pipeline";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CommsBadge, Field, StageBadge, buttonClass, WarningIcon, commsLabel, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { CommsStatus } from "@/generated/prisma/enums";
import {
  addDDItem,
  addInvestmentVote,
  addMemoVersion,
  addPreSelectionVote,
  deleteDDItem,
  moveVentureForm,
  toggleDDItem,
  updateFounderComm,
  updateVenture,
} from "../actions";
import { VentureFields } from "../venture-fields";
import { StageMover } from "./stage-mover";

export default async function DealReviewPage({ params }: PageProps<"/deals/[id]">) {
  await requireAdmin();
  const { id } = await params;

  const v = await db.venture.findUnique({
    where: { id },
    include: {
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } },
      memoVersions: { orderBy: { version: "desc" }, include: { createdBy: { select: { name: true } } } },
      ddItems: { orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { dueDate: { sort: "asc", nulls: "last" } }] },
      preSelectionVotes: { orderBy: { createdAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      investmentVotes: { orderBy: { createdAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      founderComms: { orderBy: { createdAt: "asc" }, include: { sentBy: { select: { name: true } } } },
    },
  });
  if (!v) notFound();

  const now = new Date();
  const warnings = dealWarnings(v, now);

  // The EOI window opens when the deal (most recently) entered Investment votes.
  const eoiStart = v.stageChanges.find((c) => c.toStage === "INVESTMENT_VOTES")?.changedAt ?? null;
  const eoi = eoiSummary(v.investmentVotes, eoiStart, now);
  const currentInvestmentVoteIds = new Set(latestVotePerAngel(v.investmentVotes).map((x) => x.id));
  const currentPreSelectionIds = new Set(latestVotePerAngel(v.preSelectionVotes).map((x) => x.id));
  const preSelectionInterested = v.preSelectionVotes.filter((x) => currentPreSelectionIds.has(x.id) && x.interested).length;
  const ddDone = v.ddItems.filter((i) => i.completedAt).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <Link href="/deals" className="text-sm text-dxv-green hover:underline">
          ← Deals
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-dxv-green">{v.name}</h1>
          <StageBadge stage={v.currentStage} />
          <span className="text-sm text-black/55">{daysSince(v.stageEnteredAt, now)} days in stage</span>
          {warnings.map((w) => (
            <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-dxv-yellow px-2.5 py-0.5 text-xs font-medium text-dxv-green">
              <WarningIcon title={w} /> {w}
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-black/60">
          {[v.founderNames, v.sector, v.companyStage, v.raiseAmountGbp ? `Raising ${formatGbp(v.raiseAmountGbp)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {v.currentStage === "PASSED" && v.passReason && (
          <p className="mt-2 inline-block rounded bg-black px-3 py-1 text-sm text-white">
            Passed: {PASS_REASON_LABELS[v.passReason]}
            {v.passNote ? ` — ${v.passNote}` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {v.deckUrl && <ExternalLink href={v.deckUrl}>Deck</ExternalLink>}
          {v.driveFolderUrl && <ExternalLink href={v.driveFolderUrl}>Drive folder</ExternalLink>}
          {v.website && <ExternalLink href={v.website}>Website</ExternalLink>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Main column ── */}
        <div className="space-y-6">
          <Card title="Stage">
            <StageMover currentStage={v.currentStage} action={moveVentureForm.bind(null, v.id)} />
          </Card>

          <Card title="Investment memo">
            {v.memoVersions.length === 0 ? (
              <p className="text-sm text-black/55">No memo yet. Drafted during DXV internal team review.</p>
            ) : (
              <ul className="divide-y divide-black/10">
                {v.memoVersions.map((m, i) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div>
                      <a href={m.docUrl} target="_blank" rel="noreferrer" className="font-medium text-dxv-green hover:underline">
                        Version {m.version}
                      </a>
                      {i === 0 && <span className="ml-2 rounded bg-dxv-yellow px-1.5 text-xs font-medium text-dxv-green">Latest</span>}
                      {m.summary && <p className="text-black/65">{m.summary}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-black/50">
                      {m.createdBy.name} · {formatDate(m.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addMemoVersion.bind(null, v.id)} className="mt-4 space-y-3 border-t border-black/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Memo link (Google Drive) *">
                  <input name="docUrl" type="url" required placeholder="https://docs.google.com/…" className={inputClass} />
                </Field>
                <Field label="What changed">
                  <input name="summary" className={inputClass} />
                </Field>
              </div>
              <SubmitButton variant="secondary">Add memo version</SubmitButton>
            </ActionForm>
          </Card>

          <Card
            title="Pre-Selection votes"
            actions={<span className="text-xs text-black/55">{preSelectionInterested} interested · pitch selection stage</span>}
          >
            <VoteList
              votes={v.preSelectionVotes.map((x) => ({ ...x, current: currentPreSelectionIds.has(x.id) }))}
              emptyText="No pre-selection votes recorded."
            />
            <ActionForm action={addPreSelectionVote.bind(null, v.id)} className="mt-4 space-y-3 border-t border-black/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Angel *">
                  <input name="angelName" required className={inputClass} />
                </Field>
                <Field label="Interested? *">
                  <InterestSelect />
                </Field>
                <Field label="Note">
                  <input name="note" className={inputClass} />
                </Field>
              </div>
              <SubmitButton variant="secondary">Record pre-selection vote</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Investment votes / EOI">
            <Momentum eoi={eoi} />
            <VoteList
              votes={v.investmentVotes.map((x) => ({ ...x, current: currentInvestmentVoteIds.has(x.id) }))}
              emptyText="No expressions of interest recorded."
              showTicket
            />
            <ActionForm action={addInvestmentVote.bind(null, v.id)} className="mt-4 space-y-3 border-t border-black/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Angel *">
                  <input name="angelName" required className={inputClass} />
                </Field>
                <Field label="Interested? *">
                  <InterestSelect />
                </Field>
                <Field label="Max ticket (£)">
                  <input name="maxTicketGbp" inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="Note">
                  <input name="note" className={inputClass} />
                </Field>
              </div>
              <p className="text-xs text-black/50">A new vote from the same angel supersedes their earlier one; both are kept.</p>
              <SubmitButton variant="secondary">Record EOI</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Due diligence checklist" actions={<span className="text-xs text-black/55">{ddDone}/{v.ddItems.length} done</span>}>
            {v.ddItems.length === 0 ? (
              <p className="text-sm text-black/55">No DD items yet.</p>
            ) : (
              <ul className="divide-y divide-black/10">
                {v.ddItems.map((item) => {
                  const overdue = !item.completedAt && item.dueDate && item.dueDate < now;
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                      <form action={toggleDDItem.bind(null, item.id)}>
                        <button
                          aria-label={item.completedAt ? "Mark not done" : "Mark done"}
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            item.completedAt ? "border-dxv-green bg-dxv-green text-white" : "border-black/30 bg-white"
                          }`}
                        >
                          {item.completedAt ? "✓" : ""}
                        </button>
                      </form>
                      <span className={`flex-1 ${item.completedAt ? "text-black/45 line-through" : ""}`}>
                        {item.title}
                        {item.owner && <span className="text-black/50"> · {item.owner}</span>}
                      </span>
                      {item.dueDate && (
                        <span className={`text-xs ${overdue ? "rounded bg-dxv-yellow px-1.5 font-medium text-dxv-green" : "text-black/50"}`}>
                          {overdue ? "Overdue · " : "Due "}
                          {formatDate(item.dueDate)}
                        </span>
                      )}
                      <form action={deleteDDItem.bind(null, item.id)}>
                        <button aria-label="Remove item" className="px-1 text-black/35 hover:text-black">
                          ×
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <ActionForm action={addDDItem.bind(null, v.id)} className="mt-4 space-y-3 border-t border-black/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Item *">
                  <input name="title" required className={inputClass} />
                </Field>
                <Field label="Owner">
                  <input name="owner" className={inputClass} />
                </Field>
                <Field label="Due">
                  <input name="dueDate" type="date" className={inputClass} />
                </Field>
              </div>
              <SubmitButton variant="secondary">Add DD item</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Card title="Founder comms">
            {v.founderComms.length === 0 ? (
              <p className="text-sm text-black/55">No decision gates crossed yet. Comms appear here automatically when this deal passes a gate.</p>
            ) : (
              <ul className="space-y-4">
                {v.founderComms.map((c) => (
                  <li key={c.id} className={`rounded-md border p-3 ${c.status === "NOT_YET_SENT" ? "border-dxv-yellow bg-dxv-yellow/10" : "border-black/10"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{GATE_LABELS[c.gate]}</p>
                        <p className="text-xs text-black/60">Decision: {c.decision}</p>
                      </div>
                      <CommsBadge status={c.status} />
                    </div>
                    {c.sentAt && (
                      <p className="mt-1 text-xs text-black/50">
                        Sent {formatDate(c.sentAt)}
                        {c.sentBy ? ` by ${c.sentBy.name}` : ""}
                        {c.acknowledgedAt ? ` · acknowledged ${formatDate(c.acknowledgedAt)}` : ""}
                      </p>
                    )}
                    <ActionForm action={updateFounderComm.bind(null, c.id)} resetOnSuccess={false} className="mt-2 flex flex-wrap items-end gap-2">
                      <select name="status" defaultValue={c.status} className={`${inputClass} w-auto flex-1`} aria-label="Status">
                        {Object.values(CommsStatus).map((s) => (
                          <option key={s} value={s}>
                            {commsLabel(s)}
                          </option>
                        ))}
                      </select>
                      <input name="note" defaultValue={c.note ?? ""} placeholder="Note" className={`${inputClass} w-auto flex-1`} aria-label="Note" />
                      <SubmitButton variant="secondary">Save</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Details">
            <details>
              <summary className="cursor-pointer text-sm text-dxv-green">Edit venture details</summary>
              <ActionForm action={updateVenture.bind(null, v.id)} resetOnSuccess={false} className="mt-4 space-y-4">
                <VentureFields v={v} />
                <SubmitButton>Save details</SubmitButton>
              </ActionForm>
            </details>
            {v.description && <p className="mt-3 whitespace-pre-wrap text-sm text-black/75">{v.description}</p>}
            {v.founderEmail && (
              <p className="mt-3 text-sm">
                <a href={`mailto:${v.founderEmail}`} className="text-dxv-green hover:underline">
                  {v.founderEmail}
                </a>
              </p>
            )}
          </Card>

          <Card title="Stage history">
            <ol className="space-y-3 border-l-2 border-dxv-green/20 pl-4">
              {v.stageChanges.map((c) => (
                <li key={c.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-dxv-green" />
                  <p>
                    {c.fromStage ? (
                      <>
                        {stageLabel(c.fromStage)} → <strong>{stageLabel(c.toStage)}</strong>
                      </>
                    ) : (
                      <>
                        Created at <strong>{stageLabel(c.toStage)}</strong>
                      </>
                    )}
                  </p>
                  {c.passReason && <p className="text-xs text-black/65">Reason: {PASS_REASON_LABELS[c.passReason]}</p>}
                  {c.note && <p className="text-xs text-black/65">“{c.note}”</p>}
                  <p className="text-xs text-black/45">
                    {c.changedBy.name} · {formatDateTime(c.changedAt)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
      {children} ↗
    </a>
  );
}

function InterestSelect() {
  return (
    <select name="interested" required defaultValue="" className={inputClass}>
      <option value="" disabled>
        Choose…
      </option>
      <option value="yes">Interested</option>
      <option value="no">Not interested</option>
    </select>
  );
}

type VoteRow = {
  id: string;
  angelName: string;
  interested: boolean;
  maxTicketGbp?: number;
  note: string | null;
  createdAt: Date;
  recordedBy: { name: string };
  current: boolean;
};

function VoteList({ votes, emptyText, showTicket }: { votes: VoteRow[]; emptyText: string; showTicket?: boolean }) {
  if (votes.length === 0) return <p className="text-sm text-black/55">{emptyText}</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-black/50">
        <tr>
          <th className="py-1.5 font-medium">Angel</th>
          <th className="py-1.5 font-medium">Vote</th>
          {showTicket && <th className="py-1.5 text-right font-medium">Max ticket</th>}
          <th className="py-1.5 text-right font-medium">Recorded</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/10">
        {votes.map((x) => (
          <tr key={x.id} className={x.current ? "" : "text-black/40"}>
            <td className="py-1.5">
              {x.angelName}
              {!x.current && <span className="ml-1.5 text-xs">(superseded)</span>}
              {x.note && <p className="text-xs text-black/50">{x.note}</p>}
            </td>
            <td className="py-1.5">{x.interested ? "Interested" : "Not interested"}</td>
            {showTicket && <td className="py-1.5 text-right tabular-nums">{x.interested ? formatGbp(x.maxTicketGbp ?? 0) : "—"}</td>}
            <td className="py-1.5 text-right text-xs text-black/50">
              {formatDateTime(x.createdAt)}
              <br />
              {x.recordedBy.name}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Momentum({ eoi }: { eoi: ReturnType<typeof eoiSummary> }) {
  const pct = Math.min(100, Math.round((eoi.withinWindowGbp / MOMENTUM_THRESHOLD_GBP) * 100));
  return (
    <div className="mb-4 rounded-md bg-dxv-green p-4 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="text-2xl font-semibold text-dxv-yellow">{formatGbp(eoi.withinWindowGbp)}</span>
          <span className="text-white/75"> of {formatGbp(MOMENTUM_THRESHOLD_GBP)} momentum threshold</span>
        </p>
        <p className="text-xs text-white/75">
          {eoi.windowStart
            ? eoi.windowOpen
              ? `Window open until ${formatDate(eoi.windowEnd)}`
              : `Window closed ${formatDate(eoi.windowEnd)}`
            : "Window opens when the deal enters Investment votes"}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-dxv-yellow" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-white/75">
        {eoi.thresholdMet ? "Threshold met. " : ""}
        {eoi.interestedCount} interested angel{eoi.interestedCount === 1 ? "" : "s"} · {formatGbp(eoi.totalGbp)} total indicated
        (including outside the window)
      </p>
    </div>
  );
}
