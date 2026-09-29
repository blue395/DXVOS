import "server-only";
// Loads angels with what every Angels screen shows: the certification that counts and
// its state, and committed/invested totals (votes linked by pick or confirmed alias).
// One place, so the directory, the export and the dashboard agree.
import type { AngelStatus, CertificationType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { angelTotals, certNeedsAction, certState, latestCertification, normaliseAngelName, resolveAngelId, type CertState } from "@/lib/pipeline";

export type AngelRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  status: AngelStatus;
  sectors: string[];
  tags: string[];
  whatsappGroups: string[];
  source: string | null;
  joinedAt: Date | null;
  archivedAt: Date | null;
  cert: { type: CertificationType; signedOn: Date; expiresOn: Date } | null;
  certState: CertState;
  needsAction: boolean;
  committedGbp: number;
  investedGbp: number;
  deals: number;
};

/** The confirmed aliases, as a lookup from normalised typed name to angel id. */
export async function aliasMap(): Promise<Map<string, string>> {
  const aliases = await db.angelAlias.findMany({ select: { normalized: true, angelId: true } });
  return new Map(aliases.map((a) => [a.normalized, a.angelId]));
}

export async function loadAngelRows(opts: { archived?: boolean } = {}, now = new Date()): Promise<AngelRow[]> {
  const [angels, aliases, eois, finals] = await Promise.all([
    db.angel.findMany({
      where: { archivedAt: opts.archived ? { not: null } : null },
      orderBy: { name: "asc" },
      include: { certifications: { select: { type: true, signedOn: true, expiresOn: true } } },
    }),
    aliasMap(),
    db.investmentVote.findMany({
      where: { removedAt: null },
      select: { angelId: true, angelName: true, ventureId: true, interested: true, maxTicketGbp: true, createdAt: true },
    }),
    db.finalInvestment.findMany({ where: { removedAt: null }, select: { angelId: true, angelName: true, ticketGbp: true, paidAt: true } }),
  ]);
  const eoisBy = Map.groupBy(eois, (e) => resolveAngelId(e, aliases) ?? "");
  const finalsBy = Map.groupBy(finals, (f) => resolveAngelId(f, aliases) ?? "");

  return angels.map((a) => {
    const cert = latestCertification(a.certifications);
    const state = certState(cert, now);
    const totals = angelTotals(eoisBy.get(a.id) ?? [], finalsBy.get(a.id) ?? []);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      location: a.location,
      status: a.status,
      sectors: a.sectors,
      tags: a.tags,
      whatsappGroups: a.whatsappGroups,
      source: a.source,
      joinedAt: a.joinedAt,
      archivedAt: a.archivedAt,
      cert,
      certState: state,
      needsAction: certNeedsAction(a.status, state),
      ...totals,
    };
  });
}

export type UnlinkedName = { typed: string; normalized: string; uses: number };

/** Names typed on votes and investments that don't point at an angel yet (for the linking review). */
export async function unlinkedNames(aliases?: Map<string, string>): Promise<UnlinkedName[]> {
  const [map, pre, eoi, fin] = await Promise.all([
    aliases ?? aliasMap(),
    db.preSelectionVote.findMany({ where: { angelId: null }, select: { angelName: true } }),
    db.investmentVote.findMany({ where: { angelId: null, removedAt: null }, select: { angelName: true } }),
    db.finalInvestment.findMany({ where: { angelId: null, removedAt: null }, select: { angelName: true } }),
  ]);
  const out = new Map<string, UnlinkedName>();
  for (const { angelName } of [...pre, ...eoi, ...fin]) {
    const normalized = normaliseAngelName(angelName);
    if (!normalized || map.has(normalized)) continue;
    const cur = out.get(normalized);
    out.set(normalized, { typed: cur?.typed ?? angelName.trim(), normalized, uses: (cur?.uses ?? 0) + 1 });
  }
  return [...out.values()].sort((a, b) => b.uses - a.uses || a.typed.localeCompare(b.typed));
}

/**
 * The angel a name typed on a vote or investment means: one angel with exactly that
 * name (as picked from the list), or a confirmed alias. Null otherwise (stays free text).
 */
export async function angelIdForName(typed: string): Promise<string | null> {
  const normalized = normaliseAngelName(typed);
  if (!normalized) return null;
  const [alias, named] = await Promise.all([
    db.angelAlias.findUnique({ where: { normalized }, select: { angelId: true } }),
    db.angel.findMany({ where: { archivedAt: null, name: { equals: typed.trim(), mode: "insensitive" } }, select: { id: true }, take: 2 }),
  ]);
  return named.length === 1 ? named[0].id : (alias?.angelId ?? null);
}

/** Names for the angel autocomplete on vote and investment forms. */
export async function angelNameOptions(): Promise<string[]> {
  const angels = await db.angel.findMany({ where: { archivedAt: null, status: { not: "LAPSED" } }, orderBy: { name: "asc" }, select: { name: true } });
  return [...new Set(angels.map((a) => a.name))];
}
