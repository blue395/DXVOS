import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminWith } from "@/lib/auth";
import { angelNameOptions } from "@/lib/angels";
import { db } from "@/lib/db";
import {
  GATE_LABELS,
  PASS_REASON_LABELS,
  daysSince,
  dealWarnings,
  commitmentTotal,
  formatGbp,
  latestVotePerAngel,
  stageLabel,
  canGenerateAssessment,
  roundOptionCount,
  isInvestedStage,
  investedGbp,
  splitLatestComm,
  canDecline,
  PASS_REASONS,
  advanceTarget,
  focusSections,
  gatesCrossed,
  type DealSection,
} from "@/lib/pipeline";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, CommsBadge, ExportLinks, Field, StageBadge, buttonClass, WarningIcon, commsLabel, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { CommsStatus } from "@/generated/prisma/enums";
import type { FounderComm } from "@/generated/prisma/client";
import {
  addDDItem,
  declineVenture,
  addPreSelectionVote,
  moveVentureForm,
  updateFounderComm,
  updateVenture,
} from "../../actions";
import { VentureFields } from "../../venture-fields";
import { StageMover } from "../stage-mover";
import { DocumentItem, DocumentsCard, type DocRow } from "../documents-card";
import { DocumentUploader } from "@/components/document-uploader";
import { EligibilityCard } from "../eligibility-card";
import { issueNumbers, reviewIssueName } from "@/lib/memo-ai/render";
import { AssessmentCard } from "../assessment-card";
import { DDDocumentPanel } from "../dd-document";
import { DDItemRemove, DDItemToggle } from "../dd-item-controls";
import { AdvanceButton, SectionNav, type NavItem } from "../deal-nav";
import { CommitmentsCard, FinalInvestmentCard, type AuditEntry } from "../investment-sections";
import { AngelsCard } from "../angels-card";
import { countAngelsWithDealAccess } from "@/lib/portal-deals";

export default async function DealReviewPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;

  const [v, { _max }, angelNames, membersWithAccess] = await requireAdminWith(() =>
    Promise.all([
      db.venture.findUnique({
        where: { id },
        include: {
          stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } },
          memoVersions: {
            where: { kind: { not: "DRIVE_LINK" } }, // Drive links retired 2026-09-28
            orderBy: { version: "desc" },
            include: { createdBy: { select: { name: true } }, document: { select: { id: true, fileName: true } } },
          },
          documents: {
            where: { uploadedAt: { not: null }, archivedAt: null },
            orderBy: { uploadedAt: "desc" },
            include: {
              uploadedBy: { select: { name: true } },
              ddItem: { select: { title: true } },
              memoVersion: { select: { id: true } },
              ddReportJob: { select: { id: true } }, // generated DD reports can also be exported as PDF
            },
          },
          memoAnalyses: { orderBy: { number: "desc" }, take: 1 },
          memoDrafts: { where: { archivedAt: null }, take: 1, select: { number: true, content: true, updatedAt: true } },
          ddReportJobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { createdBy: { select: { name: true } }, document: { select: { id: true, fileName: true, archivedAt: true } } },
          },
          ddItems: { orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { dueDate: { sort: "asc", nulls: "last" } }] },
          preSelectionVotes: { orderBy: { createdAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
          investmentVotes: {
            where: { removedAt: null }, // removed EOIs are hidden (kept in the audit log)
            orderBy: { createdAt: "desc" },
            include: { recordedBy: { select: { name: true } } },
          },
          finalInvestments: {
            where: { removedAt: null },
            orderBy: { createdAt: "asc" },
            include: { createdBy: { select: { name: true } }, paidBy: { select: { name: true } } },
          },
          entryAudits: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } },
          founderComms: { orderBy: { createdAt: "asc" }, include: { sentBy: { select: { name: true } } } },
          deckAnalyses: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
          eligibilityReviews: { orderBy: { decidedAt: "desc" }, include: { decidedBy: { select: { name: true } } } },
          shareLog: { orderBy: { createdAt: "desc" }, include: { by: { select: { name: true } } } },
        },
      }),
      db.venture.aggregate({ _max: { round: true } }),
      angelNameOptions(),
      countAngelsWithDealAccess(),
    ]),
  );
  if (!v) notFound();

  const now = new Date();
  const warnings = dealWarnings(v, now);

  // The EOI window opens when the deal (most recently) entered Investment Commitments.
  const commitments = commitmentTotal(v.investmentVotes);
  const currentPreSelectionIds = new Set(latestVotePerAngel(v.preSelectionVotes).map((x) => x.id));
  const preSelectionInterested = v.preSelectionVotes.filter((x) => currentPreSelectionIds.has(x.id) && x.interested).length;
  const ddDone = v.ddItems.filter((i) => i.completedAt).length;
  const issueNo = issueNumbers(v.memoVersions.filter((m) => m.kind === "REVIEWED_MEMO"));
  const docs: DocRow[] = v.documents.map((d) => ({ ...d, isMemoVersion: !!d.memoVersion, ddReportJobId: d.ddReportJob?.id ?? null }));
  const latestDeck = docs.find((d) => d.category === "DECK");


  // Layout follows the dealflow: sections that matter at this stage start open and
  // are marked "Now"; the rest collapse to a one-line summary (rules in pipeline.ts).
  const focus = new Set(focusSections(v.currentStage));
  const collapse = (s: DealSection) => ({ open: focus.has(s), now: focus.has(s) && s !== "documents" });
  const invested = investedGbp(v);
  const commsSplit = splitLatestComm(v.founderComms);
  const audits = (entity: "INVESTMENT_VOTE" | "FINAL_INVESTMENT"): AuditEntry[] => v.entryAudits.filter((a) => a.entity === entity);
  const latestMemo = v.memoVersions[0];
  const latestMemoName = latestMemo
    ? latestMemo.kind === "REVIEWED_MEMO"
      ? reviewIssueName(issueNo.get(latestMemo.id)!)
      : `Version ${latestMemo.version}`
    : null;
  const navItems: NavItem[] = [
    { id: "eligibility", label: "Eligibility", now: focus.has("eligibility") },
    { id: "assessment", label: "Assessment & memo", now: focus.has("assessment") },
    { id: "pre-selection", label: "Votes", now: focus.has("preSelection"), hint: `${preSelectionInterested}` },
    { id: "commitments", label: "Commitments", now: focus.has("commitments"), hint: formatGbp(commitments.totalGbp) },
    { id: "due-diligence", label: "DD", now: focus.has("dd"), hint: v.ddItems.length ? `${ddDone}/${v.ddItems.length}` : undefined },
    { id: "final-investment", label: "Final investment", now: focus.has("final"), hint: v.finalInvestments.length ? formatGbp(invested) : undefined },
    { id: "documents", label: "Documents", now: false, hint: `${docs.length}` },
  ];

  // One-click move to the next stage; the confirm says what the founder is owed.
  const target = advanceTarget(v.currentStage);
  const owed = target ? gatesCrossed(v.currentStage, target) : [];
  const advanceConfirm = target
    ? `Move ${v.name} to ${stageLabel(target)}?` +
      (owed.length ? ` This records "${owed.map((o) => o.decision).join('", "')}" and adds a founder update to send.` : "")
    : "";

  return (
    <div className="space-y-6">
      {/* Autocomplete for every angel-name field on this page: picking a name links the entry to that angel. */}
      <datalist id="dxv-angel-names">
        {angelNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
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
          {[
            v.round ? `Round ${v.round}` : null,
            v.leadAngel ? `Lead angel: ${v.leadAngel}` : null,
            v.founderNames,
            v.sector,
            v.companyStage,
            v.raiseAmountGbp ? `Raising ${formatGbp(v.raiseAmountGbp)}` : null,
            isInvestedStage(v.currentStage) && invested > 0 ? `DXV invested ${formatGbp(invested)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {isInvestedStage(v.currentStage) && invested === 0 && (
          <p className="mt-2 inline-block rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-1 text-sm">
            No paid tickets yet: tick payments in <a href="#final-investment" className="font-medium underline">Final investment</a> so this
            deal counts towards the dashboard&apos;s Investment Total.
          </p>
        )}
        {v.currentStage === "PASSED" && v.passReason && (
          <p className="mt-2 inline-block rounded bg-black px-3 py-1 text-sm text-white">
            Declined{v.passedFromStage ? ` at ${stageLabel(v.passedFromStage)}` : ""}: {PASS_REASON_LABELS[v.passReason]}
            {v.passNote ? `. ${v.passNote}` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {target && <AdvanceButton ventureId={v.id} to={target} label={stageLabel(target)} confirm={advanceConfirm} />}
          {v.currentStage === "ELIGIBILITY_SCREEN" && (
            <a href="#eligibility" className={buttonClass("primary")}>
              Record the eligibility decision ↓
            </a>
          )}
          {canDecline(v.currentStage) && (
            <Reveal label="Decline" buttonClassName={declinePillClass}>
              <ActionForm action={declineVenture.bind(null, v.id)} className="space-y-3">
                <p className="text-sm">
                  Decline <strong>{v.name}</strong> at <strong>{stageLabel(v.currentStage)}</strong>. The deal is kept (for dealflow
                  learning) and a founder update is flagged as owed in Founder comms.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Reason *">
                    <select name="passReason" required defaultValue="" className={inputClass}>
                      <option value="" disabled>
                        Choose a reason…
                      </option>
                      {PASS_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {PASS_REASON_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Note" hint="Required for Other; saved to stage history">
                    <input name="note" className={inputClass} />
                  </Field>
                </div>
                <SubmitButton pendingLabel="Declining…" doneLabel="Declined">
                  Decline deal
                </SubmitButton>
              </ActionForm>
            </Reveal>
          )}
          <Reveal label={v.currentStage === "PASSED" ? "Reopen or move…" : "Other move…"}>
            {/* key: reset the dropdown whenever the stage changes elsewhere (board, eligibility decision) */}
            <StageMover key={v.currentStage} currentStage={v.currentStage} action={moveVentureForm.bind(null, v.id)} />
          </Reveal>
          {latestDeck && <ExternalLink href={`/api/documents/${latestDeck.id}`}>Deck</ExternalLink>}
          {v.website && <ExternalLink href={v.website}>Website</ExternalLink>}
        </div>
      </div>

      <SectionNav items={navItems} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-6">

          {/* Page follows the dealflow: eligibility, assessment, memo, votes, commitments, DD. */}
          <EligibilityCard
            ventureId={v.id}
            stage={v.currentStage}
            analyses={v.deckAnalyses}
            reviews={v.eligibilityReviews}
            collapse={collapse("eligibility")}
          />

          <AssessmentCard
            collapse={collapse("assessment")}
            ventureId={v.id}
            canGenerate={canGenerateAssessment(v.currentStage)}
            hasDeck={v.deckAnalyses.some((a) => a.status !== "PENDING")}
            latest={v.memoAnalyses[0] ?? null}
            draft={v.memoDrafts[0] ?? null}
            reviewed={(() => {
              const latestIssue = v.memoVersions.find((m) => m.kind === "REVIEWED_MEMO");
              return latestIssue ? { ...latestIssue, issueNumber: issueNo.get(latestIssue.id)! } : null;
            })()}
            memoSummary={latestMemoName ? `Latest memo: ${latestMemoName}` : null}
          >
            {v.memoVersions.length === 0 ? (
              <p className="text-sm text-black/55">
                No memo yet. Mark a DXV Review Draft complete to issue one, or upload a memo file below.
              </p>
            ) : (
              <ul className="divide-y divide-black/10">
                {v.memoVersions.map((m, i) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div>
                      {m.kind === "REVIEWED_MEMO" ? (
                        <Link href={`/deals/${v.id}/assessment?view=v-${m.version}`} className="font-medium text-dxv-green hover:underline">
                          {reviewIssueName(issueNo.get(m.id)!)}
                        </Link>
                      ) : m.document ? (
                        <a href={`/api/documents/${m.document.id}`} target="_blank" rel="noreferrer" className="font-medium text-dxv-green hover:underline">
                          Version {m.version} · {m.document.fileName}
                        </a>
                      ) : null}
                      {i === 0 && <span className="ml-2 rounded bg-dxv-yellow px-1.5 text-xs font-medium text-dxv-green">Latest</span>}
                      {m.summary && <p className="text-black/65">{m.summary}</p>}
                      {m.kind === "REVIEWED_MEMO" && (
                        <div className="mt-1">
                          <ExportLinks href={`/api/export/issue/${m.id}`} />
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-black/50">
                      {m.createdBy.name} · {formatDate(m.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <DocumentUploader ventureId={v.id} category="MEMO" label="Upload a memo file (PDF or Word) as a new version" />
            </div>
          </AssessmentCard>

          <Card
            title="Pre-Selection votes"
            id="pre-selection"
            collapse={{
              ...collapse("preSelection"),
              summary: `${preSelectionInterested} interested of ${currentPreSelectionIds.size} vote${currentPreSelectionIds.size === 1 ? "" : "s"}`,
            }}
            actions={<span className="text-xs text-black/55">{preSelectionInterested} interested · pitch selection stage</span>}
          >
            <VoteList
              votes={v.preSelectionVotes.map((x) => ({ ...x, current: currentPreSelectionIds.has(x.id) }))}
              emptyText="No votes yet. Record each angel's vote on whether this venture should pitch."
            />
            <div className="mt-4 border-t border-black/10 pt-4">
              <Reveal label="+ Record pre-selection vote">
                <ActionForm action={addPreSelectionVote.bind(null, v.id)} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Angel *">
                      <input name="angelName" required list="dxv-angel-names" autoComplete="off" className={inputClass} />
                    </Field>
                    <Field label="Interested? *">
                      <InterestSelect />
                    </Field>
                    <Field label="Note">
                      <input name="note" className={inputClass} />
                    </Field>
                  </div>
                  <SubmitButton doneLabel="Recorded">Record vote</SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          </Card>

          <CommitmentsCard
            ventureId={v.id}
            votes={v.investmentVotes}
            audits={audits("INVESTMENT_VOTE")}
            collapse={collapse("commitments")}
          />

          <Card
            title="Due Diligence"
            id="due-diligence"
            collapse={{
              ...collapse("dd"),
              summary: v.ddItems.length ? `${ddDone}/${v.ddItems.length} items done` : "No DD items yet",
            }}
            actions={<span className="text-xs text-black/55">{ddDone}/{v.ddItems.length} done</span>}
          >
            <DDDocumentPanel ventureId={v.id} stage={v.currentStage} latest={v.ddReportJobs[0] ?? null} />
            {v.ddItems.length === 0 ? (
              <p className="text-sm text-black/55">No DD items yet. Add the checks the DD group will work through, with an owner and due date.</p>
            ) : (
              <ul className="divide-y divide-black/10">
                {v.ddItems.map((item) => {
                  const overdue = !item.completedAt && item.dueDate && item.dueDate < now;
                  return (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <DDItemToggle itemId={item.id} done={!!item.completedAt} />
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
                      <DDItemRemove itemId={item.id} title={item.title} />
                      <span className="w-full pl-8">
                        {docs.filter((d) => d.ddItemId === item.id).length > 0 && (
                          <ul>
                            {docs
                              .filter((d) => d.ddItemId === item.id)
                              .map((d) => (
                                <DocumentItem key={d.id} d={{ ...d, ddItem: null }} />
                              ))}
                          </ul>
                        )}
                        <DocumentUploader ventureId={v.id} category="DUE_DILIGENCE" ddItemId={item.id} compact />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 border-t border-black/10 pt-4">
              <Reveal label="+ Add DD item">
                <ActionForm action={addDDItem.bind(null, v.id)} className="space-y-3">
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
                  <SubmitButton doneLabel="Added">Add DD item</SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          </Card>

          <FinalInvestmentCard
            ventureId={v.id}
            entries={v.finalInvestments}
            audits={audits("FINAL_INVESTMENT")}
            canAddFromEois={commitments.interestedCount > 0}
            collapse={collapse("final")}
          />

          <DocumentsCard ventureId={v.id} docs={docs} collapse={collapse("documents")} />

        </div>

        {/* ── Sidebar ── */}
        <div className="min-w-0 space-y-6">
          <Card title="Details">
            <details>
              <summary className="cursor-pointer text-sm text-dxv-green">Edit venture details</summary>
              <ActionForm action={updateVenture.bind(null, v.id)} resetOnSuccess={false} className="mt-4 space-y-4">
                <VentureFields v={v} roundOptions={roundOptionCount(_max.round)} />
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

          <AngelsCard
            ventureId={v.id}
            name={v.name}
            stage={v.currentStage}
            sharedAt={v.sharedWithAngelsAt}
            summary={v.angelSummary}
            docs={v.documents.filter((d) => !d.ddReportJob)} // AI-generated DD reports stay team-only
            latestIssueName={(() => {
              const issue = v.memoVersions.find((m) => m.kind === "REVIEWED_MEMO");
              return issue ? reviewIssueName(issueNo.get(issue.id)!) : null;
            })()}
            membersWithAccess={membersWithAccess}
            log={v.shareLog}
          />

          <Card title="Founder comms">
            {commsSplit.latest === null ? (
              <p className="text-sm text-black/55">No decision gates crossed yet. Comms appear here automatically when this deal passes a gate.</p>
            ) : (
              <div className="space-y-3">
                {/* The most recent comm, sent or not; earlier ones fold away. */}
                <ul>
                  <CommItem c={commsSplit.latest} />
                </ul>
                {commsSplit.earlier.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded px-1 py-0.5 text-sm text-dxv-green transition hover:bg-dxv-green/5 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="text-xs transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      <span className="group-open:hidden">Show {commsSplit.earlier.length} earlier</span>
                      <span className="hidden group-open:inline">Hide {commsSplit.earlier.length} earlier</span>
                      {commsSplit.earlierPending > 0 && (
                        <span className="ml-1 rounded-full bg-dxv-yellow px-2 py-px text-xs font-medium">{commsSplit.earlierPending} not yet sent</span>
                      )}
                    </summary>
                    <ul className="mt-3 space-y-3">
                      {commsSplit.earlier.map((c) => (
                        <CommItem key={c.id} c={c} />
                      ))}
                    </ul>
                  </details>
                )}
              </div>
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
                    {c.changedBy?.name ?? "System"} · {formatDateTime(c.changedAt)}
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

const declinePillClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-black bg-white px-3.5 py-1.5 text-sm font-medium text-black transition hover:-translate-y-px hover:bg-black hover:text-white active:translate-y-0";

type CommRow = FounderComm & { sentBy: { name: string } | null };

/** One founder comm: the gate, what the founder is told, status and a quick update form. */
function CommItem({ c }: { c: CommRow }) {
  return (
    <li className={`rounded-md border p-3 ${c.status === "NOT_YET_SENT" ? "border-dxv-yellow bg-dxv-yellow/10" : "border-black/10"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
  );
}
