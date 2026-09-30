import "server-only";
// DXV's syndicate portfolio (the team's Portfolio page): every deal DXV invested in, from
// the deal records (paid Final Investment tickets, as the dashboard's Investment Total),
// with the team's details on top; plus syndicate investments the team added by hand
// (earlier rounds not tracked as deals).
import type { InvestmentInstrument, Stage } from "@/generated/prisma/enums";
import { aliasMap } from "@/lib/angels";
import { db } from "@/lib/db";
import { investedGbp, normaliseAngelName, resolveAngelId, type HoldingStatusKey, type PortfolioHoldingLike, type TaxSchemeKey } from "@/lib/pipeline";
import { companyFactsSelect, dxvCompanyFacts } from "@/lib/portfolio";

export type SyndicateRow = PortfolioHoldingLike & {
  key: string;
  holdingId: string | null;
  ventureId: string | null;
  description: string | null;
  round: number | null;
  companyStage: string | null;
  angelsCount: number | null;
  instrument: InvestmentInstrument | null;
  valuationAtInvestment: number | null;
  sharePrice: number | null;
  currentValueOn: Date | null;
  diversityThemes: string[];
  notes: string | null;
  stage: Stage | null;
};

const INVESTED_STAGES: Stage[] = ["INVESTMENT_COMPLETE", "SEIS_CERTIFICATE"];

export async function loadSyndicatePortfolio(): Promise<{ rows: SyndicateRow[]; angelsInvesting: number }> {
  const [ventures, added, aliases] = await Promise.all([
    db.venture.findMany({
      where: { currentStage: { in: INVESTED_STAGES } },
      select: {
        id: true,
        name: true,
        sector: true,
        companyStage: true,
        round: true,
        currentStage: true,
        stageEnteredAt: true,
        investedAmountGbp: true,
        finalInvestments: { where: { removedAt: null }, select: { ticketGbp: true, paidAt: true, angelId: true, angelName: true } },
        syndicateHolding: true,
        ...companyFactsSelect,
      },
    }),
    db.syndicateHolding.findMany({ where: { ventureId: null, archivedAt: null } }),
    aliasMap(),
  ]);

  const allAngels = new Set<string>();
  const tracked: SyndicateRow[] = ventures.map((v) => {
    const o = v.syndicateHolding && !v.syndicateHolding.archivedAt ? v.syndicateHolding : null;
    const facts = dxvCompanyFacts(v);
    const paid = v.finalInvestments.filter((f) => f.paidAt);
    const angels = new Set(paid.map((f) => resolveAngelId(f, aliases) ?? `name:${normaliseAngelName(f.angelName)}`));
    angels.forEach((a) => allAngels.add(a));
    const invested = investedGbp(v);
    const lastPaid = paid.reduce<Date | null>((d, f) => (!d || f.paidAt! > d ? f.paidAt : d), null);
    return {
      key: `v-${v.id}`,
      holdingId: o?.id ?? null,
      ventureId: v.id,
      company: v.name,
      source: "DXV",
      description: o?.description ?? facts.about,
      sector: v.sector,
      round: v.round,
      companyStage: v.companyStage,
      investedOn: lastPaid ?? v.stageEnteredAt,
      currency: "GBP",
      amountMinor: invested * 100,
      // At Investment Complete but no paid ticket recorded yet: listed, not counted.
      pending: invested === 0,
      angelsCount: angels.size || null,
      stage: v.currentStage,
      ...details(o),
      diversityThemes: facts.diversityThemes, // the deal's founderDiversity: one source of truth
    };
  });

  const own: SyndicateRow[] = added.map((o) => ({
    key: `h-${o.id}`,
    holdingId: o.id,
    ventureId: null,
    company: o.companyName ?? "Unnamed company",
    source: "OUTSIDE",
    description: o.description,
    sector: o.sector,
    round: o.round,
    companyStage: o.companyStage,
    investedOn: o.investedOn,
    currency: o.currency,
    amountMinor: o.amountMinor,
    pending: false,
    angelsCount: o.angelsCount,
    stage: null,
    ...details(o),
    diversityThemes: o.diversityThemes,
  }));

  const rows = [...tracked, ...own].sort((a, b) => (b.investedOn?.getTime() ?? 0) - (a.investedOn?.getTime() ?? 0));
  return { rows, angelsInvesting: allAngels.size };
}

type Details = {
  instrument: InvestmentInstrument | null;
  valuationAtInvestment: number | null;
  sharePrice: number | null;
  currentValueMinor: number | null;
  currentValueOn: Date | null;
  status: HoldingStatusKey;
  proceedsMinor: number | null;
  taxScheme: TaxSchemeKey | null;
  notes: string | null;
};

function details(o: Details | null) {
  return {
    instrument: o?.instrument ?? null,
    valuationAtInvestment: o?.valuationAtInvestment ?? null,
    sharePrice: o?.sharePrice ?? null,
    currentValueMinor: o?.currentValueMinor ?? null,
    currentValueOn: o?.currentValueOn ?? null,
    status: o?.status ?? ("ACTIVE" as const),
    proceedsMinor: o?.proceedsMinor ?? null,
    taxScheme: o?.taxScheme ?? null,
    notes: o?.notes ?? null,
    keyDate: null,
    keyDateNote: null,
  };
}
