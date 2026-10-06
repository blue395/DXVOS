import "server-only";
// The Insights page's numbers (team only): growth, engagement and investment. Everything is
// read in one parallel batch, then shaped by the pure rules in pipeline.ts. Partners' own
// portal visits are left out (PortalView.team), and nothing from My Portfolio is read.

import { db } from "./db";
import { templateProblems } from "./member-email";
import {
  canSeeLiveDeals,
  daysAgo,
  declineReasons,
  insightNudges,
  isInvestedStage,
  latestCertification,
  latestVotePerAngel,
  medianDaysInStage,
  monthlyCounts,
  normaliseAngelName,
  pct,
  platformFunnel,
  sourceBreakdown,
  stageReach,
  ticketStats,
  weeklyActive,
} from "./pipeline";
import type { Stage } from "@/generated/prisma/enums";

const SYNDICATE_STAGES: Stage[] = ["PITCH_SELECTION", "PITCH_OUTCOME", "INVESTMENT_COMMITMENTS", "DUE_DILIGENCE", "INVESTMENT_COMPLETE", "SEIS_CERTIFICATE"];
const LOW_TURNOUT_PCT = 30;
const QUIET_DAYS = 30;

export async function loadInsights(periodDays: number, now = new Date()) {
  const since = daysAgo(periodDays, now);
  const viewsSince = daysAgo(Math.max(periodDays, 7 * 12), now); // the weekly chart covers 12 weeks
  const [angels, views, lastSeen, ventures, aliases, emails, unsubscribes, welcome, allViews, founderSources] = await Promise.all([
    db.angel.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        source: true,
        joinedAt: true,
        createdAt: true,
        archivedAt: true,
        profileConfirmedAt: true,
        onboardedAt: true,
        restrictedDeclaredAt: true,
        user: { select: { role: true, createdAt: true } },
        certifications: { select: { type: true, signedOn: true, expiresOn: true } },
        invites: { where: { kind: "INVITE" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, usedAt: true, revokedAt: true, expiresAt: true } },
      },
    }),
    db.portalView.findMany({ where: { team: false, createdAt: { gte: viewsSince } }, select: { angelId: true, kind: true, ventureId: true, createdAt: true } }),
    db.portalView.groupBy({ by: ["angelId"], where: { team: false }, _max: { createdAt: true } }),
    db.venture.findMany({
      select: {
        id: true,
        name: true,
        currentStage: true,
        createdAt: true,
        importedAt: true,
        passReason: true,
        round: true,
        sharedWithAngelsAt: true,
        raiseAmountGbp: true,
        founderDiversity: true,
        stageChanges: { select: { toStage: true, changedAt: true } },
        preSelectionVotes: { select: { angelId: true, angelName: true, interested: true, createdAt: true } },
        investmentVotes: { where: { removedAt: null }, select: { angelId: true, angelName: true, interested: true, maxTicketGbp: true, createdAt: true } },
        finalInvestments: { where: { removedAt: null }, select: { angelId: true, angelName: true, ticketGbp: true, paidAt: true } },
      },
    }),
    db.angelAlias.findMany({ select: { normalized: true, angelId: true } }),
    db.memberEmail.findMany({ where: { createdAt: { gte: since } }, select: { id: true, recipients: { where: { status: "SENT" }, select: { id: true } } } }),
    db.angel.count({ where: { emailOptOutAt: { not: null }, erasedAt: null } }),
    db.emailTemplate.findUnique({ where: { key: "welcome" }, select: { subject: true, body: true } }),
    // Every member who ever opened each deal (room or document): one row per member and deal.
    db.portalView.findMany({ where: { team: false, ventureId: { not: null } }, select: { angelId: true, ventureId: true }, distinct: ["angelId", "ventureId"] }),
    // How founders who applied on the website heard about DXV (in the period).
    db.founderSubmission.findMany({ where: { status: "COMPLETE", createdAt: { gte: since } }, select: { heardFrom: true } }),
  ]);

  // ── Who's who ────────────────────────────────────────────────────────────
  const aliasTo = new Map(aliases.map((a) => [a.normalized, a.angelId]));
  const who = (e: { angelId: string | null; angelName: string }) => e.angelId ?? aliasTo.get(normaliseAngelName(e.angelName)) ?? `name:${normaliseAngelName(e.angelName)}`;
  const lastSeenBy = new Map(lastSeen.map((l) => [l.angelId, l._max.createdAt]));
  const people = angels.map((a) => {
    const cert = latestCertification(a.certifications);
    const invite = a.invites[0];
    return {
      ...a,
      hasLogin: !!a.user,
      canSeeDeals: canSeeLiveDeals(a, cert, now) && !a.restrictedDeclaredAt,
      invited: !!invite || !!a.user,
      inviteWaiting: !!invite && !invite.usedAt && !invite.revokedAt && invite.expiresAt > now,
      inviteAgeDays: invite ? (now.getTime() - invite.createdAt.getTime()) / 86_400_000 : 0,
      lastSeen: lastSeenBy.get(a.id) ?? null,
    };
  });
  const members = people.filter((p) => p.status === "MEMBER");
  const prospects = people.filter((p) => p.status === "PROSPECT");
  const eligible = members.filter((m) => m.canSeeDeals);

  // ── Growth ───────────────────────────────────────────────────────────────
  const growth = {
    members: members.length,
    prospects: prospects.length,
    lapsed: people.filter((p) => p.status === "LAPSED").length,
    newMembers: members.filter((m) => m.joinedAt && m.joinedAt >= since).length,
    joinedByMonth: monthlyCounts(members.flatMap((m) => (m.joinedAt ? [m.joinedAt] : [])), 12, now),
    sources: sourceBreakdown(members.map((m) => m.source)),
    funnel: platformFunnel(people.filter((p) => p.status !== "LAPSED").map((p) => ({ ...p, profileConfirmed: !!p.profileConfirmedAt, onboarded: !!p.onboardedAt }))),
    onPlatformPct: pct(members.filter((m) => m.hasLogin).length, members.length),
    canSeeDealsPct: pct(eligible.length, members.length),
  };

  // ── Engagement ───────────────────────────────────────────────────────────
  const inPeriod = views.filter((v) => v.createdAt >= since);
  const activeSince = (days: number) => new Set(views.filter((v) => v.createdAt >= daysAgo(days, now)).map((v) => v.angelId)).size;
  const dayKey = (v: { angelId: string; createdAt: Date }) => `${v.angelId}:${v.createdAt.toISOString().slice(0, 10)}`;
  const votesInPeriod = new Map<string, number>();
  for (const v of ventures)
    for (const vote of [...v.preSelectionVotes, ...v.investmentVotes])
      if (vote.createdAt >= since) votesInPeriod.set(who(vote), (votesInPeriod.get(who(vote)) ?? 0) + 1);
  const byAngel = Map.groupBy(inPeriod, (v) => v.angelId);
  const engaged = [...byAngel.entries()]
    .map(([angelId, vs]) => {
      const p = people.find((x) => x.id === angelId);
      return {
        id: angelId,
        name: p?.name ?? "Former member",
        activeDays: new Set(vs.map(dayKey)).size,
        dealsViewed: new Set(vs.filter((v) => v.ventureId).map((v) => v.ventureId)).size,
        votes: votesInPeriod.get(angelId) ?? 0,
        lastSeen: p?.lastSeen ?? null,
      };
    })
    .sort((a, b) => b.activeDays - a.activeDays || b.votes - a.votes || a.name.localeCompare(b.name))
    .slice(0, 10);
  const quiet = eligible
    .filter((m) => m.hasLogin && (!m.lastSeen || m.lastSeen < daysAgo(QUIET_DAYS, now)))
    .map((m) => ({ id: m.id, name: m.name, lastSeen: m.lastSeen }))
    .sort((a, b) => (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0));
  const engagement = {
    active7: activeSince(7),
    active30: activeSince(30),
    visits: new Set(inPeriod.map(dayKey)).size,
    dealViews: inPeriod.filter((v) => v.kind === "DEAL").length,
    dealViewers: new Set(inPeriod.filter((v) => v.kind === "DEAL" || v.kind === "DOCUMENT").map((v) => v.angelId)).size,
    documentOpens: inPeriod.filter((v) => v.kind === "DOCUMENT").length,
    weekly: weeklyActive(views, 12, now),
    engaged,
    quiet,
    emailsSent: emails.length,
    emailCopies: emails.reduce((n, e) => n + e.recipients.length, 0),
    unsubscribes,
  };

  // ── Investment: per deal, then across members ───────────────────────────
  const viewersOf = Map.groupBy(allViews, (v) => v.ventureId!);
  const syndicateDeals = ventures
    .filter((v) => SYNDICATE_STAGES.includes(v.currentStage) || (v.currentStage === "PASSED" && v.sharedWithAngelsAt))
    .map((v) => {
      const pre = latestVotePerAngel(v.preSelectionVotes);
      const eois = latestVotePerAngel(v.investmentVotes).filter((e) => e.interested);
      const tickets = v.finalInvestments;
      const committed = eois.reduce((n, e) => n + (e.maxTicketGbp ?? 0), 0);
      const voters = v.currentStage === "PITCH_SELECTION" ? pre.length : v.currentStage === "PITCH_OUTCOME" ? latestVotePerAngel(v.investmentVotes).length : null;
      return {
        id: v.id,
        name: v.name,
        stage: v.currentStage,
        round: v.round,
        shared: !!v.sharedWithAngelsAt,
        viewers: viewersOf.get(v.id)?.length ?? 0,
        preVoters: pre.length,
        preYes: pre.filter((p) => p.interested).length,
        eoiCount: eois.length,
        eoiGbp: committed,
        ticketCount: tickets.length,
        ticketGbp: tickets.reduce((n, t) => n + t.ticketGbp, 0),
        paidGbp: tickets.filter((t) => t.paidAt).reduce((n, t) => n + t.ticketGbp, 0),
        raiseGbp: v.raiseAmountGbp,
        turnoutPct: voters === null ? null : pct(voters, eligible.length),
      };
    })
    .sort((a, b) => SYNDICATE_STAGES.indexOf(a.stage) - SYNDICATE_STAGES.indexOf(b.stage) || a.name.localeCompare(b.name));

  const memberIds = new Set(members.map((m) => m.id));
  const viewedAny = new Set(allViews.map((v) => v.angelId));
  const votedAny = new Set(ventures.flatMap((v) => [...v.preSelectionVotes, ...v.investmentVotes].map(who)));
  const eoiAny = new Set(ventures.flatMap((v) => v.investmentVotes.filter((e) => e.interested).map(who)));
  const paidTickets = ventures.flatMap((v) => v.finalInvestments.filter((t) => t.paidAt).map((t) => ({ investor: who(t), ventureId: v.id, ticketGbp: t.ticketGbp, paidAt: t.paidAt! })));
  const investedAny = new Set(paidTickets.map((t) => t.investor));
  const inMembers = (s: Set<string>) => [...s].filter((id) => memberIds.has(id)).length;
  const tickets = ticketStats(paidTickets);
  const years = [...new Set(paidTickets.map((t) => t.paidAt.getUTCFullYear()))].sort();
  const investment = {
    deals: syndicateDeals,
    memberFunnel: [
      { label: "Members", value: members.length },
      { label: "Can see deals", value: eligible.length },
      { label: "Opened a deal room", value: inMembers(viewedAny) },
      { label: "Voted on a deal", value: inMembers(votedAny) },
      { label: "Expressed interest (EOI)", value: inMembers(eoiAny) },
      { label: "Invested (paid)", value: inMembers(investedAny) },
    ],
    tickets,
    investedMemberPct: pct(inMembers(investedAny), members.length),
    byYear: years.map((y) => ({ key: String(y), label: String(y), value: paidTickets.filter((t) => t.paidAt.getUTCFullYear() === y).reduce((n, t) => n + t.ticketGbp, 0) })),
  };

  // ── Dealflow ─────────────────────────────────────────────────────────────
  const tracked = ventures.filter((v) => !v.importedAt);
  const reach = stageReach(tracked.map((v) => ({ stagesReached: [...v.stageChanges.map((c) => c.toStage), v.currentStage] })));
  const invested = ventures.filter((v) => isInvestedStage(v.currentStage));
  const themeCounts = new Map<string, number>();
  for (const v of invested) for (const t of v.founderDiversity) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  const dealflow = {
    newDeals: tracked.filter((v) => v.createdAt >= since).length,
    byMonth: monthlyCounts(tracked.map((v) => v.createdAt), 12, now),
    reach,
    conversionPct: pct(reach.at(-1)?.value ?? 0, reach[0]?.value ?? 0),
    daysInStage: medianDaysInStage(tracked.flatMap((v) => v.stageChanges.map((c) => ({ ventureId: v.id, ...c })))),
    declined: ventures.filter((v) => v.currentStage === "PASSED").length,
    declineReasons: declineReasons(ventures.filter((v) => v.currentStage === "PASSED").map((v) => v.passReason)),
    diversity: [...themeCounts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    investedDeals: invested.length,
    websiteSubmissions: founderSources.length,
    founderSources: sourceBreakdown(founderSources.map((f) => f.heardFrom)),
  };

  const nudges = insightNudges({
    welcomeNeedsFinishing: !welcome || templateProblems(welcome).length > 0,
    membersNotOnPlatform: members.filter((m) => !m.hasLogin).length,
    invitesUnusedOver7Days: people.filter((p) => p.inviteWaiting && p.inviteAgeDays > 7).length,
    membersNeedingStatement: members.filter((m) => !m.canSeeDeals && !m.restrictedDeclaredAt).length,
    quietMembers: quiet.length,
    prospectsNotInvited: prospects.filter((p) => !p.invited).length,
    lowTurnoutDeals: syndicateDeals
      .filter((d) => d.shared && d.turnoutPct !== null && d.turnoutPct < LOW_TURNOUT_PCT && eligible.length > 0)
      .map((d) => ({ id: d.id, name: d.name, turnoutPct: d.turnoutPct! })),
  });

  return { growth, engagement, investment, dealflow, nudges, hasVisits: views.length > 0 };
}
export type Insights = Awaited<ReturnType<typeof loadInsights>>;
