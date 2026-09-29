import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Reveal } from "@/components/reveal";
import { Card, Field, formatDate, inputClass } from "@/components/ui";
import type { ComplianceTextKind } from "@/generated/prisma/enums";
import { requireAdminWith } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMPLIANCE_KINDS } from "@/lib/compliance";
import { COMPLIANCE_KIND_LABELS, DEFAULT_COMPLIANCE_TEXTS } from "@/lib/compliance-texts";
import { ComplianceTextView as TextView } from "@/components/compliance-text";
import { saveComplianceDraft } from "./actions";
import { ApproveTextButton } from "./approve-button";

export default async function StatementsPage() {
  const texts = await requireAdminWith(() =>
    db.complianceText.findMany({
      orderBy: [{ kind: "asc" }, { version: "desc" }],
      include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } }, _count: { select: { certifications: true } } },
    }),
  );
  const byKind = Map.groupBy(texts, (t) => t.kind);
  const allApproved = COMPLIANCE_KINDS.every((k) => byKind.get(k)?.some((t) => t.status === "APPROVED"));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Investor statements and member terms</h1>
        <p className="text-sm text-black/60">
          The wording angels read and sign in the portal. Angels only ever see an approved version; every signature records the exact version signed.
          Editing saves a new draft version (earlier versions are kept).
        </p>
      </div>
      <p
        role="status"
        className={`rounded-md px-3 py-2 text-sm ${allApproved ? "bg-dxv-green/10 text-dxv-green" : "border-l-4 border-dxv-yellow bg-dxv-yellow/25 text-black"}`}
      >
        {allApproved
          ? "✓ All three texts are approved: angels can be invited."
          : "Invites are paused until all three texts are approved. The starting drafts follow the FCA Financial Promotion Order 2005 (Schedule 5, as amended in 2024) and must be checked word for word against legislation.gov.uk (Kevin) before approval."}
      </p>

      {COMPLIANCE_KINDS.map((kind) => (
        <KindCard key={kind} kind={kind} versions={byKind.get(kind) ?? []} />
      ))}
    </div>
  );
}

type Version = {
  id: string;
  version: number;
  title: string;
  body: string;
  criteria: string[];
  status: "DRAFT" | "APPROVED" | "RETIRED";
  note: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  createdBy: { name: string };
  approvedBy: { name: string } | null;
  _count: { certifications: number };
};

function KindCard({ kind, versions }: { kind: ComplianceTextKind; versions: Version[] }) {
  const approved = versions.find((v) => v.status === "APPROVED");
  const latest = versions[0];
  const pendingDraft = latest?.status === "DRAFT" ? latest : null;
  const base = latest ?? { ...DEFAULT_COMPLIANCE_TEXTS[kind], version: 0 };
  return (
    <Card title={COMPLIANCE_KIND_LABELS[kind]}>
      <div className="space-y-4 text-sm">
        <p>
          {approved ? (
            <span className="rounded-full bg-dxv-green px-2 py-0.5 text-xs font-medium text-white">
              Approved: version {approved.version}, by {approved.approvedBy?.name} on {formatDate(approved.approvedAt)}
            </span>
          ) : (
            <span className="rounded-full bg-dxv-yellow px-2 py-0.5 text-xs font-semibold text-black">Not approved yet</span>
          )}
          {approved && approved._count.certifications > 0 && <span className="ml-2 text-xs text-black/55">{approved._count.certifications} signed</span>}
        </p>

        {pendingDraft ? (
          <div className="space-y-2 rounded-lg border border-dxv-yellow bg-dxv-yellow/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
              Draft version {pendingDraft.version}, by {pendingDraft.createdBy.name}
              {pendingDraft.note && `: ${pendingDraft.note}`}
            </p>
            <TextView title={pendingDraft.title} body={pendingDraft.body} criteria={pendingDraft.criteria} />
            <ApproveTextButton id={pendingDraft.id} version={pendingDraft.version} />
          </div>
        ) : approved ? (
          <details>
            <summary className="cursor-pointer text-dxv-green hover:underline">Read the approved wording</summary>
            <div className="mt-2">
              <TextView title={approved.title} body={approved.body} criteria={approved.criteria} />
            </div>
          </details>
        ) : (
          <div className="space-y-2 rounded-lg border border-black/10 bg-black/[0.02] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Starting draft (not saved yet): review it, then save and approve</p>
            <TextView {...DEFAULT_COMPLIANCE_TEXTS[kind]} />
          </div>
        )}

        <Reveal label={versions.length ? "Edit (saves a new draft version)" : "Review and save as draft"}>
          <ActionForm action={saveComplianceDraft} className="space-y-3">
            <input type="hidden" name="kind" value={kind} />
            <Field label="Title">
              <input name="title" defaultValue={base.title} required className={inputClass} />
            </Field>
            <Field label="Wording">
              <textarea name="body" defaultValue={base.body} rows={12} required className={`${inputClass} font-mono text-xs`} />
            </Field>
            {kind !== "MEMBER_TERMS" && (
              <Field label="Qualifying criteria (one per line; the angel ticks at least one)">
                <textarea name="criteria" defaultValue={base.criteria.join("\n")} rows={6} required className={`${inputClass} font-mono text-xs`} />
              </Field>
            )}
            <Field label="What changed (optional)">
              <input name="note" placeholder="e.g. Checked against legislation.gov.uk by Kevin" className={inputClass} />
            </Field>
            <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
          </ActionForm>
        </Reveal>

        {versions.length > 1 && (
          <details className="text-xs text-black/60">
            <summary className="cursor-pointer">Version history ({versions.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {versions.map((v) => (
                <li key={v.id}>
                  v{v.version} · {v.status.toLowerCase()} · saved by {v.createdBy.name} {formatDate(v.createdAt)}
                  {v.approvedAt && ` · approved by ${v.approvedBy?.name} ${formatDate(v.approvedAt)}`}
                  {v._count.certifications > 0 && ` · ${v._count.certifications} signed`}
                  {v.note && ` · ${v.note}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}
