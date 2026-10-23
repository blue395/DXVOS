// "Download my data" (docs/privacy, right of access / portability): everything DXV OS holds
// about the signed-in member, as JSON or CSV. Their own data only: the id comes from the
// session, never the request. Not included: other people's data, and the team's internal
// notes about the member (give those on a formal access request: see the rights procedure).
// Nothing is logged except that a download happened (AngelEvent, no contents).
import { getCurrentUser, hasMemberAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { csvCell } from "@/lib/csv";
import { normaliseAngelName } from "@/lib/pipeline";
import { exportMyDiversity } from "@/lib/diversity/store";
import { CATEGORY_LABELS } from "@/lib/diversity/questions";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasMemberAccess(user) || !user.angelId) return new Response("Unauthorised", { status: 401 });
  const angelId = user.angelId;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";

  const [angel, login, aliases, certifications, events, preVotes, eois, finals, holdings, emails, views, diversity] = await Promise.all([
    db.angel.findUniqueOrThrow({
      where: { id: angelId },
      select: {
        name: true, email: true, phone: true, linkedinUrl: true, location: true, bio: true, sectors: true, tags: true, status: true, source: true,
        ticketRange: true, experience: true, joinedAt: true, profileConfirmedAt: true, onboardedAt: true, restrictedDeclaredAt: true,
        emailOptOutAt: true, ageConfirmedAt: true, diversityPromptedAt: true, whatsappGroups: true, createdAt: true, updatedAt: true,
      },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { email: true, role: true, createdAt: true, lastSignInAt: true, identities: { where: { removedAt: null }, select: { provider: true, email: true, createdAt: true, lastUsedAt: true } } } }),
    db.angelAlias.findMany({ where: { angelId }, select: { normalized: true } }),
    db.angelCertification.findMany({ where: { angelId }, select: { type: true, signedOn: true, expiresOn: true, fileName: true }, orderBy: { signedOn: "desc" } }),
    db.angelEvent.findMany({ where: { angelId }, select: { kind: true, detail: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    db.preSelectionVote.findMany({ where: { OR: [{ angelId }, { angelId: null }] }, select: { angelId: true, angelName: true, interested: true, note: true, createdAt: true, venture: { select: { name: true } } } }),
    db.investmentVote.findMany({ where: { removedAt: null, OR: [{ angelId }, { angelId: null }] }, select: { angelId: true, angelName: true, interested: true, maxTicketGbp: true, note: true, createdAt: true, venture: { select: { name: true } } } }),
    db.finalInvestment.findMany({ where: { removedAt: null, OR: [{ angelId }, { angelId: null }] }, select: { angelId: true, angelName: true, ticketGbp: true, paidAt: true, note: true, createdAt: true, venture: { select: { name: true } } } }),
    db.portfolioHolding.findMany({ where: { angelId, archivedAt: null } }),
    db.memberEmailRecipient.findMany({ where: { angelId }, select: { email: true, status: true, sentAt: true, memberEmail: { select: { subject: true } } } }),
    db.portalView.findMany({ where: { angelId }, select: { kind: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
    exportMyDiversity(angelId),
  ]);
  // Entries typed under an older name count when the team confirmed that name is theirs.
  const names = new Set(aliases.map((a) => a.normalized));
  const mine = <T extends { angelId: string | null; angelName: string }>(rows: T[]) =>
    rows
      .filter((r) => r.angelId === angelId || (!r.angelId && names.has(normaliseAngelName(r.angelName))))
      .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "angelId" && k !== "angelName")));

  const data = {
    about: "Everything DXV OS holds about you, downloaded from your member portal.",
    downloadedAt: new Date().toISOString(),
    profile: angel,
    login,
    investorStatements: certifications,
    activity: events,
    preSelectionVotes: mine(preVotes),
    expressionsOfInterest: mine(eois),
    investments: mine(finals),
    myPortfolio: holdings,
    emailsSentToYou: emails,
    portalVisits: views,
    diversityInformation: {
      ...diversity,
      categories: CATEGORY_LABELS,
    },
  };
  await db.angelEvent.create({ data: { angelId, kind: "data-downloaded", detail: format.toUpperCase(), actorId: user.id } });

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="My DXV data ${stamp}.json"`, "Cache-Control": "no-store" },
    });
  }
  // CSV: one row per value (section, item, field, value), so every part fits one file.
  const rows: string[][] = [["section", "item", "field", "value"]];
  const walk = (section: string, item: string, v: unknown, field = "") => {
    if (v === null || v === undefined || typeof v !== "object" || v instanceof Date) {
      rows.push([section, item, field, v instanceof Date ? v.toISOString() : v == null ? "" : String(v)]);
    } else if (Array.isArray(v)) {
      if (v.every((x) => typeof x !== "object" || x === null)) rows.push([section, item, field, v.join("; ")]);
      else v.forEach((x, i) => walk(section, String(i + 1), x, field));
    } else {
      for (const [k, x] of Object.entries(v)) walk(section, item, x, field ? `${field}.${k}` : k);
    }
  };
  for (const [section, v] of Object.entries(data)) walk(section, "", v);
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="My DXV data ${stamp}.csv"`, "Cache-Control": "no-store" },
  });
}
