// Investment Commitments / EOI and Final Investment sections of the deal page.
// Entries can be edited and removed; every change is listed under History.

import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, type CardCollapse, Field, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { describeChange } from "@/lib/audit";
import { commitmentTotal, finalInvestmentTotals, formatGbp, latestVotePerAngel } from "@/lib/pipeline";
import {
  addFinalFromEois,
  addFinalInvestment,
  addInvestmentVote,
  removeFinalInvestment,
  removeInvestmentVote,
  updateFinalInvestment,
  updateInvestmentVote,
} from "../actions";
import { EntryRow, PaidToggle } from "./entry-controls";

type Person = { name: string };
export type EoiEntry = {
  id: string;
  angelName: string;
  interested: boolean;
  maxTicketGbp: number;
  note: string | null;
  createdAt: Date;
  editedAt: Date | null;
  recordedBy: Person;
};
export type FinalEntry = {
  id: string;
  angelName: string;
  ticketGbp: number;
  note: string | null;
  paidAt: Date | null;
  paidBy: Person | null;
  createdAt: Date;
  editedAt: Date | null;
  createdBy: Person;
};
export type AuditEntry = { id: string; action: "EDIT" | "REMOVE" | "PAID" | "UNPAID"; before: unknown; after: unknown; changedAt: Date; changedBy: Person };

function InterestSelect({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <select name="interested" required defaultValue={defaultValue} className={inputClass}>
      <option value="" disabled>
        Choose…
      </option>
      <option value="yes">Interested</option>
      <option value="no">Not interested</option>
    </select>
  );
}

function History({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-dxv-green hover:underline">
        History ({entries.length} change{entries.length === 1 ? "" : "s"})
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-dxv-green/15 pl-3">
        {entries.map((a) => (
          <li key={a.id}>
            {describeChange(a)}
            <span className="text-black/45">
              {" "}
              · {a.changedBy.name}, {formatDateTime(a.changedAt)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function TotalBar({ big, text }: { big: string; text: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md bg-dxv-green px-4 py-3 text-white">
      <span className="text-3xl font-semibold text-dxv-yellow tabular-nums">{big}</span>
      <span className="text-sm text-white/80">{text}</span>
    </div>
  );
}

// ── Investment Commitments / EOI ────────────────────────────────────────────

function EoiFields({ v }: { v?: EoiEntry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Angel *">
        <input name="angelName" required list="dxv-angel-names" autoComplete="off" defaultValue={v?.angelName} className={inputClass} />
      </Field>
      <Field label="Interested? *">
        <InterestSelect defaultValue={v ? (v.interested ? "yes" : "no") : ""} />
      </Field>
      <Field label="Max ticket (£)">
        <input name="maxTicketGbp" inputMode="numeric" defaultValue={v?.maxTicketGbp || ""} className={inputClass} />
      </Field>
      <Field label="Note">
        <input name="note" defaultValue={v?.note ?? ""} className={inputClass} />
      </Field>
    </div>
  );
}

export function CommitmentsCard({
  ventureId,
  votes,
  audits,
  collapse,
}: {
  ventureId: string;
  votes: EoiEntry[]; // live (not removed), newest first
  audits: AuditEntry[];
  collapse: CardCollapse;
}) {
  const t = commitmentTotal(votes);
  const current = new Set(latestVotePerAngel(votes).map((v) => v.id));
  const angels = `${t.interestedCount} interested angel${t.interestedCount === 1 ? "" : "s"}`;
  return (
    <Card title="Investment commitments / EOI" id="commitments" collapse={{ ...collapse, summary: `${formatGbp(t.totalGbp)} from ${angels}` }}>
      <TotalBar big={formatGbp(t.totalGbp)} text={`committed so far · ${angels}`} />
      {votes.length === 0 ? (
        <p className="text-sm text-black/55">No expressions of interest yet. Record each angel&apos;s EOI and maximum ticket as they come in.</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {votes.map((v) => (
            <EntryRow
              key={v.id}
              label={`${v.angelName}'s EOI`}
              remove={removeInvestmentVote.bind(null, v.id)}
              editForm={
                <ActionForm action={updateInvestmentVote.bind(null, v.id)} resetOnSuccess={false} className="space-y-3">
                  <EoiFields v={v} />
                  <SubmitButton>Save changes</SubmitButton>
                </ActionForm>
              }
            >
              <div className={`flex flex-wrap items-baseline justify-between gap-x-3 ${current.has(v.id) ? "" : "text-black/40"}`}>
                <span>
                  <strong className="font-medium">{v.angelName}</strong>
                  {!current.has(v.id) && <span className="ml-1.5 text-xs">(superseded)</span>}
                  <span className="text-black/60"> · {v.interested ? "Interested" : "Not interested"}</span>
                  {v.interested && <span className="font-medium tabular-nums"> · {formatGbp(v.maxTicketGbp)}</span>}
                </span>
                <span className="text-xs text-black/45">
                  {v.recordedBy.name}, {formatDate(v.createdAt)}
                  {v.editedAt && " · edited"}
                </span>
              </div>
              {v.note && <p className="text-xs text-black/55">{v.note}</p>}
            </EntryRow>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-black/50">A new EOI from the same angel supersedes their earlier one. Edit to correct a mistake.</p>
      <History entries={audits} />
      <div className="mt-4 border-t border-black/10 pt-4">
        <Reveal label="+ Record EOI">
          <ActionForm action={addInvestmentVote.bind(null, ventureId)} className="space-y-3">
            <EoiFields />
            <SubmitButton doneLabel="Recorded">Record EOI</SubmitButton>
          </ActionForm>
        </Reveal>
      </div>
    </Card>
  );
}

// ── Final Investment ────────────────────────────────────────────────────────

function FinalFields({ v, withPaid }: { v?: FinalEntry; withPaid?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Angel *">
        <input name="angelName" required list="dxv-angel-names" autoComplete="off" defaultValue={v?.angelName} className={inputClass} />
      </Field>
      <Field label="Ticket (£) *">
        <input name="ticketGbp" required inputMode="numeric" defaultValue={v?.ticketGbp ?? ""} className={inputClass} />
      </Field>
      <Field label="Note">
        <input name="note" defaultValue={v?.note ?? ""} className={inputClass} />
      </Field>
      {withPaid && (
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="paid" className="h-4 w-4 accent-dxv-green" /> Payment already received
        </label>
      )}
    </div>
  );
}

export function FinalInvestmentCard({
  ventureId,
  entries,
  audits,
  canAddFromEois,
  collapse,
}: {
  ventureId: string;
  entries: FinalEntry[]; // live (not removed)
  audits: AuditEntry[];
  canAddFromEois: boolean;
  collapse: CardCollapse;
}) {
  const t = finalInvestmentTotals(entries);
  return (
    <Card
      title="Final investment"
      id="final-investment"
      collapse={{
        ...collapse,
        summary: entries.length ? `${formatGbp(t.paidGbp)} paid of ${formatGbp(t.committedGbp)} · ${t.angels} angel${t.angels === 1 ? "" : "s"}` : "No final tickets yet",
      }}
    >
      <TotalBar
        big={formatGbp(t.paidGbp)}
        text={`paid of ${formatGbp(t.committedGbp)} committed · ${t.paidCount}/${t.angels} angel${t.angels === 1 ? "" : "s"} paid`}
      />
      <p className="mb-2 text-xs text-black/55">
        Each angel&apos;s actual ticket. Tick when the money arrives: paid tickets count towards the dashboard&apos;s Investment Total once the
        deal reaches Investment Complete.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-black/55">No final tickets yet. Add each investing angel, or start from the EOIs.</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {entries.map((e) => (
            <EntryRow
              key={e.id}
              label={`${e.angelName}'s ticket`}
              remove={removeFinalInvestment.bind(null, e.id)}
              editForm={
                <ActionForm action={updateFinalInvestment.bind(null, e.id)} resetOnSuccess={false} className="space-y-3">
                  <FinalFields v={e} />
                  <SubmitButton>Save changes</SubmitButton>
                </ActionForm>
              }
            >
              <div className="flex items-start gap-3">
                <PaidToggle entryId={e.id} paid={!!e.paidAt} angelName={e.angelName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <strong className="font-medium">{e.angelName}</strong>
                      <span className="font-medium tabular-nums"> · {formatGbp(e.ticketGbp)}</span>
                      <span className={e.paidAt ? "text-dxv-green" : "text-black/50"}>
                        {" "}
                        · {e.paidAt ? `Paid ${formatDate(e.paidAt)}` : "Awaiting payment"}
                      </span>
                    </span>
                    <span className="text-xs text-black/45">
                      {e.createdBy.name}, {formatDate(e.createdAt)}
                      {e.editedAt && " · edited"}
                    </span>
                  </div>
                  {e.note && <p className="text-xs text-black/55">{e.note}</p>}
                </div>
              </div>
            </EntryRow>
          ))}
        </ul>
      )}
      <History entries={audits} />
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4">
        <Reveal label="+ Add angel">
          <ActionForm action={addFinalInvestment.bind(null, ventureId)} className="space-y-3">
            <FinalFields withPaid />
            <SubmitButton doneLabel="Added">Add ticket</SubmitButton>
          </ActionForm>
        </Reveal>
        {canAddFromEois && (
          <ActionButton run={addFinalFromEois.bind(null, ventureId)} variant="secondary" pendingLabel="Adding…">
            Add interested angels from EOIs
          </ActionButton>
        )}
      </div>
    </Card>
  );
}
