import "server-only";
// My Portfolio: an angel's investments in one place. DXV syndicate investments come from
// the deal records (Final Investment tickets linked to this angel by pick or confirmed
// alias), with the angel's own details on top; investments outside DXV are the angel's
// own records. Private to the angel: nothing here is shown in the team app.
import type { InvestmentInstrument, Stage } from "@/generated/prisma/enums";
import { aliasMap } from "@/lib/angels";
import { db } from "@/lib/db";
import { firstSentences, resolveAngelId, type HoldingStatusKey, type PortfolioHoldingLike, type TaxSchemeKey } from "@/lib/pipeline";

/**
 * What DXV already knows about a company, for portfolios: a sentence or two about it (the
 * summary written for members, else the opening of the latest locked DXV memo; never the
 * internal description or AI screens) and its founder diversity: the deal's own
 * `founderDiversity`, the single source of truth (edited in the deal page's Details).
 */
export function dxvCompanyFacts(v: { oneLiner: string | null; angelSummary: string | null; founderDiversity: string[]; memoVersions: { content: unknown }[] }): {
  about: string | null;
  diversityThemes: string[];
} {
  const memo = v.memoVersions[0]?.content as { executiveSummary?: unknown } | null | undefined;
  return {
    // The deal's one-liner first: the same line the team and members see everywhere else.
    about: v.oneLiner?.trim() || firstSentences(v.angelSummary) || firstSentences(typeof memo?.executiveSummary === "string" ? memo.executiveSummary : null),
    diversityThemes: v.founderDiversity,
  };
}

/** Prisma select for dxvCompanyFacts(): the members' summary, founder diversity and the latest locked memo. */
export const companyFactsSelect = {
  oneLiner: true,
  angelSummary: true,
  founderDiversity: true,
  memoVersions: { where: { kind: "REVIEWED_MEMO" as const }, orderBy: { version: "desc" as const }, take: 1, select: { content: true } },
};

export type PortfolioRow = PortfolioHoldingLike & {
  key: string;
  holdingId: string | null;
  finalInvestmentId: string | null;
  description: string | null;
  investedVia: string | null;
  round: string | null;
  instrument: InvestmentInstrument | null;
  valuationAtInvestment: number | null;
  sharePrice: number | null;
  shares: number | null;
  currentValueOn: Date | null;
  taxCertificateReceived: boolean;
  shareCertificateReceived: boolean;
  heardVia: string | null;
  rationale: string | null;
  notes: string | null;
  /** DXV only: the deal has reached the S/EIS certificate stage. */
  dxvCertificatesStage: boolean;
  /** Founder diversity themes (DXV investments: from the locked memo). */
  diversityThemes: string[];
};

export type PendingInterest = { ventureId: string; company: string; maxTicketGbp: number; stage: Stage };

type Overlay = {
  id: string;
  description: string | null;
  sector: string | null;
  instrument: InvestmentInstrument | null;
  valuationAtInvestment: number | null;
  sharePrice: number | null;
  shares: number | null;
  currentValueMinor: number | null;
  currentValueOn: Date | null;
  status: HoldingStatusKey;
  proceedsMinor: number | null;
  taxScheme: TaxSchemeKey | null;
  taxCertificateReceived: boolean;
  shareCertificateReceived: boolean;
  keyDate: Date | null;
  keyDateNote: string | null;
  source: string | null;
  rationale: string | null;
  notes: string | null;
};

const overlayFields = (o: Overlay | null) => ({
  instrument: o?.instrument ?? null,
  valuationAtInvestment: o?.valuationAtInvestment ?? null,
  sharePrice: o?.sharePrice ?? null,
  shares: o?.shares ?? null,
  currentValueMinor: o?.currentValueMinor ?? null,
  currentValueOn: o?.currentValueOn ?? null,
  status: o?.status ?? ("ACTIVE" as const),
  proceedsMinor: o?.proceedsMinor ?? null,
  taxScheme: o?.taxScheme ?? null,
  taxCertificateReceived: o?.taxCertificateReceived ?? false,
  shareCertificateReceived: o?.shareCertificateReceived ?? false,
  keyDate: o?.keyDate ?? null,
  keyDateNote: o?.keyDateNote ?? null,
  heardVia: o?.source ?? null,
  rationale: o?.rationale ?? null,
  notes: o?.notes ?? null,
});

/** This angel's Final Investment tickets (by pick or confirmed alias), live ones only. */
async function myFinals(angelId: string) {
  const [finals, aliases] = await Promise.all([
    db.finalInvestment.findMany({
      where: { removedAt: null, OR: [{ angelId }, { angelId: null }] },
      include: { venture: { select: { id: true, name: true, sector: true, companyStage: true, currentStage: true, ...companyFactsSelect } }, holding: true },
    }),
    aliasMap(),
  ]);
  return finals.filter((f) => resolveAngelId(f, aliases) === angelId);
}

/** Whether this Final Investment ticket is this angel's (for their details on it). */
export async function ownsFinalInvestment(angelId: string, finalInvestmentId: string) {
  return (await myFinals(angelId)).find((f) => f.id === finalInvestmentId) ?? null;
}

export async function loadPortfolio(angelId: string): Promise<{ rows: PortfolioRow[]; pendingInterest: PendingInterest[] }> {
  const [finals, outside, eois, aliases] = await Promise.all([
    myFinals(angelId),
    db.portfolioHolding.findMany({ where: { angelId, finalInvestmentId: null, archivedAt: null } }),
    // Expressions of interest still in progress (no ticket yet): shown as "in progress", never as invested.
    db.investmentVote.findMany({
      where: {
        removedAt: null,
        OR: [{ angelId }, { angelId: null }],
        venture: { currentStage: { in: ["PITCH_OUTCOME", "INVESTMENT_COMMITMENTS", "DUE_DILIGENCE"] } },
      },
      orderBy: { createdAt: "desc" },
      select: { angelId: true, angelName: true, interested: true, maxTicketGbp: true, ventureId: true, venture: { select: { name: true, currentStage: true } } },
    }),
    aliasMap(),
  ]);

  const dxv: PortfolioRow[] = finals.map((f) => {
    const o = f.holding && f.holding.angelId === angelId ? f.holding : null;
    const facts = dxvCompanyFacts(f.venture);
    return {
      key: `d-${f.id}`,
      holdingId: o?.id ?? null,
      finalInvestmentId: f.id,
      company: f.venture.name,
      source: "DXV",
      description: o?.description ?? facts.about,
      sector: f.venture.sector ?? o?.sector ?? null,
      investedVia: "Diversity X Ventures",
      round: f.venture.companyStage,
      investedOn: f.paidAt ?? f.createdAt,
      currency: "GBP",
      amountMinor: f.ticketGbp * 100,
      pending: !f.paidAt,
      dxvCertificatesStage: f.venture.currentStage === "SEIS_CERTIFICATE",
      diversityThemes: facts.diversityThemes,
      ...overlayFields(o),
    };
  });

  const own: PortfolioRow[] = outside.map((o) => ({
    key: `h-${o.id}`,
    holdingId: o.id,
    finalInvestmentId: null,
    company: o.companyName ?? "Unnamed company",
    source: "OUTSIDE",
    description: o.description,
    sector: o.sector,
    investedVia: o.investedVia,
    round: o.round,
    investedOn: o.investedOn,
    currency: o.currency,
    amountMinor: o.amountMinor,
    pending: false,
    dxvCertificatesStage: false,
    diversityThemes: [], // not recorded for investments outside DXV (special-category data)
    ...overlayFields(o),
  }));

  // Latest EOI per deal; interested, and no ticket on that deal yet.
  const ticketVentures = new Set(finals.map((f) => f.ventureId));
  const seen = new Set<string>();
  const pendingInterest: PendingInterest[] = [];
  for (const e of eois) {
    if (resolveAngelId(e, aliases) !== angelId || seen.has(e.ventureId)) continue;
    seen.add(e.ventureId);
    if (e.interested && !ticketVentures.has(e.ventureId)) {
      pendingInterest.push({ ventureId: e.ventureId, company: e.venture.name, maxTicketGbp: e.maxTicketGbp, stage: e.venture.currentStage });
    }
  }

  const rows = [...dxv, ...own].sort((a, b) => (b.investedOn?.getTime() ?? 0) - (a.investedOn?.getTime() ?? 0));
  return { rows, pendingInterest };
}
