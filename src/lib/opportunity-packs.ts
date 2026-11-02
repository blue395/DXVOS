import "server-only";
// The members' opportunities pack as a PDF, shared by the team's preview, the members'
// portal download and email attachments. Only approved packs are ever for members.
import { db } from "@/lib/db";
import { renderOpportunityPdf, type SlideLogo } from "@/lib/opportunities/slides";
import type { OpportunityContent } from "@/lib/opportunities/schema";

/** The latest logo for each company. */
export async function latestLogos(ventureIds: string[]): Promise<Map<string, SlideLogo>> {
  const rows = await db.ventureLogo.findMany({
    where: { ventureId: { in: ventureIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["ventureId"],
    select: { ventureId: true, mimeType: true, data: true },
  });
  return new Map(rows.map((r) => [r.ventureId, { mimeType: r.mimeType, data: new Uint8Array(r.data) }]));
}

export const packFileName = (title: string) =>
  `DXV ${
    title
      .replace(/[^A-Za-z0-9 ]+/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Syndicate Opportunities"
  }.pdf`;

/** The pack's PDF, or null. `approvedOnly`: for anything that reaches members. */
export async function opportunityPackPdf(id: string, opts: { approvedOnly: boolean }): Promise<{ bytes: Uint8Array; fileName: string; round: number } | null> {
  const p = await db.opportunityPack.findUnique({ where: { id }, select: { status: true, content: true, approvedAt: true, round: true } });
  if (!p || p.status !== "COMPLETE" || !p.content) return null;
  if (opts.approvedOnly && !p.approvedAt) return null;
  const content = p.content as OpportunityContent;
  const bytes = await renderOpportunityPdf(content, { logos: await latestLogos(content.deals.map((d) => d.ventureId)), draft: !p.approvedAt });
  return { bytes, fileName: packFileName(content.title), round: p.round };
}

/** The latest approved pack for a round (what members can download), or null. */
export async function approvedPackFor(round: number | null) {
  if (round === null) return null;
  return db.opportunityPack.findFirst({
    where: { round, approvedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { id: true, title: true, approvedAt: true },
  });
}
