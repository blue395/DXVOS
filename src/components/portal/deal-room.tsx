// One deal as members see it: summary, pitch deck, memo (DXV Review Issue) and the
// documents shared for the deal's phase. A plain view of loadDealRoom()'s output, so the
// team's "Preview as angel" shows exactly the same page. Server-component safe.
import { DocSpecView } from "@/components/doc-spec-view";
import { formatDate } from "@/components/ui";
import { CATEGORY_LABELS, fileKind, formatFileSize } from "@/lib/documents";
import { ANGEL_PHASE_LABELS, formatGbp, type AngelDealPhase } from "@/lib/pipeline";
import type { DealRoom, DealRoomDoc } from "@/lib/portal-deals";

const PHASE_HELP: Record<AngelDealPhase, string> = {
  "pitch-selection": "DXV is asking members which companies they'd like to hear pitch. Read the deck and tell us if you're interested.",
  "post-pitch": "The company has pitched. Read the deck, DXV's memo and the supporting documents, then tell us whether you'd like to invest.",
  commitments: "Members are committing to invest. All the documents for this deal are below.",
};

export function PhaseBadge({ phase }: { phase: AngelDealPhase }) {
  return <span className="inline-block whitespace-nowrap rounded-full bg-dxv-yellow px-2.5 py-0.5 text-xs font-semibold text-dxv-green">{ANGEL_PHASE_LABELS[phase]}</span>;
}

export function DealRoomView({ deal, docHref, voting }: { deal: DealRoom; docHref: (id: string, download?: boolean) => string; voting?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-dxv-green">{deal.name}</h1>
          <PhaseBadge phase={deal.phase} />
        </div>
        {deal.oneLiner && <p className="mt-1 text-base text-black/75">{deal.oneLiner}</p>}
        <p className="mt-1 text-sm text-black/60">
          {[deal.sector, deal.companyStage, deal.raiseAmountGbp ? `Raising ${formatGbp(deal.raiseAmountGbp)}` : null].filter(Boolean).join(" · ")}
          {deal.website && (
            <>
              {" · "}
              <a href={deal.website} target="_blank" rel="noreferrer" className="text-dxv-green underline">
                Website ↗
              </a>
            </>
          )}
        </p>
        <p className="mt-2 text-sm">{PHASE_HELP[deal.phase]}</p>
      </div>

      {deal.summary && <p className="whitespace-pre-wrap rounded-lg border border-black/10 bg-white p-4 text-sm">{deal.summary}</p>}

      {voting}

      <Section title="Pitch deck">
        {deal.deck ? <DocLink d={deal.deck} href={docHref} /> : <p className="text-sm text-black/55">The deck will appear here shortly.</p>}
      </Section>

      {deal.phase !== "pitch-selection" && (
        <Section title="DXV investment memo">
          {deal.memo ? (
            <DocSpecView spec={deal.memo.spec} />
          ) : (
            <p className="text-sm text-black/55">DXV&apos;s memo will appear here once it&apos;s issued.</p>
          )}
        </Section>
      )}

      {deal.ddOpen && deal.committed && (
        <Section title="Due diligence">
          <p className="mb-2 text-sm text-black/65">Shared with members who committed to invest in {deal.name}.</p>
          {deal.ddDocuments.length ? (
            <ul className="divide-y divide-black/10">
              {deal.ddDocuments.map((d) => (
                <DocLink key={d.id} d={d} href={docHref} showCategory />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-black/55">DXV will share its due diligence here as it&apos;s completed.</p>
          )}
        </Section>
      )}

      {deal.phase !== "pitch-selection" && (
        <Section title="Documents">
          {deal.documents.length ? (
            <ul className="divide-y divide-black/10">
              {deal.documents.map((d) => (
                <DocLink key={d.id} d={d} href={docHref} showCategory />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-black/55">No other documents shared yet.</p>
          )}
        </Section>
      )}

      <p className="text-xs text-black/55">
        Shared in confidence under the DXV member terms: please don&apos;t forward these materials. Investing in early-stage companies is high risk:
        you could lose all the money you invest. DXV doesn&apos;t give investment, tax or legal advice.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h2>
      {children}
    </section>
  );
}

function DocLink({ d, href, showCategory }: { d: DealRoomDoc; href: (id: string, download?: boolean) => string; showCategory?: boolean }) {
  const Tag = showCategory ? "li" : "div";
  return (
    <Tag className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="rounded bg-dxv-green/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-dxv-green">{fileKind(d.mimeType)}</span>
      <a href={href(d.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-dxv-green hover:underline">
        {d.fileName}
      </a>
      <span className="text-xs text-black/50">
        {showCategory ? `${CATEGORY_LABELS[d.category]} · ` : ""}
        {formatFileSize(d.sizeBytes)} · {formatDate(d.uploadedAt)}
      </span>
      <a href={href(d.id, true)} className="text-xs text-dxv-green hover:underline">
        Download
      </a>
    </Tag>
  );
}
