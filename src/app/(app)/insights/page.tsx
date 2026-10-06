import Link from "next/link";
import { BarList, ColumnChart, Funnel, Meter, StatTile, TableView } from "@/components/insights/charts";
import { formatDate } from "@/components/ui";
import { requireAdminWith } from "@/lib/auth";
import { loadInsights } from "@/lib/insights";
import { INSIGHT_PERIODS, formatGbp, formatGbpCompact, parseInsightPeriod, stageLabel } from "@/lib/pipeline";

export const metadata = { title: "Insights · DXV OS" };

// Team only: how DXV grows its angels, how engaged they are, and how deals convert into
// investments. Numbers come from src/lib/insights.ts; rules from pipeline.ts.
export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const sp = await searchParams;
  const period = parseInsightPeriod(sp.period);
  const periodLabel = INSIGHT_PERIODS.find((p) => p.days === period)!.label;
  const { growth, engagement, investment, dealflow, nudges, hasVisits } = await requireAdminWith(() => loadInsights(period));
  const gbp = (n: number) => formatGbpCompact(n);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dxv-green">Insights</h1>
          <p className="text-sm text-black/60">Growing DXV&apos;s angels, keeping them engaged, and turning deals into investments.</p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-full border border-black/10 bg-white p-1 text-sm">
          {INSIGHT_PERIODS.map((p) => (
            <Link
              key={p.days}
              href={`/insights?period=${p.days}`}
              aria-current={p.days === period ? "page" : undefined}
              className={`rounded-full px-3 py-1 ${p.days === period ? "bg-dxv-green font-medium text-white" : "text-black/65 hover:bg-dxv-green/5"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* What to act on */}
      <Section title="What to act on" note="The few things most likely to grow membership, engagement and investment right now.">
        {nudges.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/60">Nothing needs action right now.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {nudges.map((n) => (
              <li key={n.text} className="flex flex-col justify-between gap-2 rounded-xl border-l-4 border-dxv-yellow bg-dxv-yellow/15 p-4">
                <div>
                  <p className="font-semibold text-black">{n.text}</p>
                  {n.detail && <p className="text-sm text-black/65">{n.detail}</p>}
                </div>
                <Link href={n.href} className="self-start text-sm font-medium text-dxv-green underline">
                  {n.action} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Growth */}
      <Section title="Growth" note="More angels: who joins, where they come from, and how far they get onto the platform.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Members" value={growth.members} note={`+${growth.newMembers} joined in ${periodLabel}`} href="/angels?filter=members" />
          <StatTile label="Prospects" value={growth.prospects} note="Interested, not members yet" href="/angels?filter=prospects" />
          <StatTile label="On the platform" value={`${growth.onPlatformPct}%`} note="of members have signed up" />
          <StatTile label="Can see deals" value={`${growth.canSeeDealsPct}%`} note="of members, with a current statement" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Members joined, by month">
            <ColumnChart title="Members joined, by month" points={growth.joinedByMonth} partialLast="this month so far" unit="members" />
          </Panel>
          <Panel title="Where members come from" note="From each member's “how did you hear about DXV”.">
            <BarList rows={growth.sources} empty="No sources recorded yet." />
            <TableView headers={["Source", "Members"]} rows={growth.sources.map((s) => [s.label, s.value])} />
          </Panel>
        </div>
        <Panel title="Getting onto the platform" note="Members and prospects, step by step. Each step counts only those who passed the one before.">
          <Funnel steps={growth.funnel} />
        </Panel>
      </Section>

      {/* Engagement */}
      <Section title="Engagement" note="How often members use the platform, and who's gone quiet.">
        {!hasVisits && (
          <p className="rounded-md bg-dxv-yellow/30 px-3 py-2 text-sm">
            Visit tracking has just started, so visit numbers will build up from today. Votes and investments already include everything on record.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Active this week" value={engagement.active7} note="members who visited in 7 days" />
          <StatTile label="Active this month" value={engagement.active30} note="members who visited in 30 days" />
          <StatTile label="Deal rooms opened" value={engagement.dealViews} note={`by ${engagement.dealViewers} members in ${periodLabel}`} />
          <StatTile label="Documents opened" value={engagement.documentOpens} note={`decks, memos and files in ${periodLabel}`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Members active each week" note="Distinct members who opened the portal (partners left out).">
            <ColumnChart title="Members active each week" points={engagement.weekly} partialLast="this week so far" unit="members" />
          </Panel>
          <Panel title="Platform adoption">
            <div className="space-y-4">
              <Meter label="Members signed up to the platform" pct={growth.onPlatformPct} />
              <Meter label="Members who can see deals" pct={growth.canSeeDealsPct} note="Signed up, with a current investor statement." />
              <p className="text-sm text-black/65">
                Emails to angels in {periodLabel}: <strong>{engagement.emailsSent}</strong> sent ({engagement.emailCopies} copies). Unsubscribed overall:{" "}
                <strong>{engagement.unsubscribes}</strong>.
              </p>
            </div>
          </Panel>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Most engaged, ${periodLabel}`} note="Days active on the platform, deals opened and votes cast.">
            {engagement.engaged.length === 0 ? (
              <p className="text-sm text-black/50">No visits recorded in this period yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-black/50">
                  <tr>
                    <th className="py-1 font-medium">Member</th>
                    <th className="py-1 text-right font-medium">Days</th>
                    <th className="py-1 text-right font-medium">Deals</th>
                    <th className="py-1 text-right font-medium">Votes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {engagement.engaged.map((e) => (
                    <tr key={e.id}>
                      <td className="py-1.5">
                        <Link href={`/angels/${e.id}`} className="hover:text-dxv-green hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{e.activeDays}</td>
                      <td className="py-1.5 text-right tabular-nums">{e.dealsViewed}</td>
                      <td className="py-1.5 text-right tabular-nums">{e.votes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <div id="quiet" className="scroll-mt-4">
            <Panel title="Gone quiet" note="Members who can see deals but haven't visited in 30 days. A personal message usually works best.">
              {engagement.quiet.length === 0 ? (
                <p className="text-sm text-black/50">Everyone who can see deals has visited in the last 30 days.</p>
              ) : (
                <ul className="max-h-72 divide-y divide-black/5 overflow-y-auto text-sm">
                  {engagement.quiet.map((q) => (
                    <li key={q.id} className="flex justify-between gap-2 py-1.5">
                      <Link href={`/angels/${q.id}`} className="hover:text-dxv-green hover:underline">
                        {q.name}
                      </Link>
                      <span className="text-xs text-black/50">{q.lastSeen ? `last seen ${formatDate(q.lastSeen)}` : "no visit recorded"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </Section>

      {/* Investment */}
      <Section title="Investment" note="How members move from seeing a deal to investing in it.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Invested" value={gbp(investment.tickets.total)} note={`${investment.tickets.count} paid tickets`} />
          <StatTile label="Typical ticket" value={gbp(investment.tickets.median)} note={`median; average ${gbp(investment.tickets.average)}`} />
          <StatTile label="Investors" value={investment.tickets.investors} note={`${investment.investedMemberPct}% of members have invested`} />
          <StatTile label="Repeat investors" value={investment.tickets.repeatInvestors} note="invested in 2 or more deals" />
        </div>
        <Panel title="From member to investor" note="All time. Each step counts members who have done it at least once.">
          <Funnel steps={investment.memberFunnel} />
        </Panel>
        <Panel title="Deals with members" note="Members who opened each deal, how they voted, what they expressed interest in, and what was invested.">
          {investment.deals.length === 0 ? (
            <p className="text-sm text-black/50">No deals have reached members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-black/50">
                  <tr>
                    <th className="py-1.5 font-medium">Deal</th>
                    <th className="py-1.5 font-medium">Stage</th>
                    <th className="py-1.5 text-right font-medium">Opened by</th>
                    <th className="py-1.5 text-right font-medium">Pitch votes (yes)</th>
                    <th className="py-1.5 text-right font-medium">Turnout</th>
                    <th className="py-1.5 text-right font-medium">EOIs</th>
                    <th className="py-1.5 text-right font-medium">Tickets / raise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {investment.deals.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2">
                        <Link href={`/deals/${d.id}`} className="font-medium hover:text-dxv-green hover:underline">
                          {d.name}
                        </Link>
                        {!d.shared && <span className="ml-1 text-xs text-black/45">(not shared)</span>}
                      </td>
                      <td className="py-2 text-black/65">{d.stage === "PASSED" ? "Declined" : stageLabel(d.stage)}</td>
                      <td className="py-2 text-right tabular-nums">{d.viewers}</td>
                      <td className="py-2 text-right tabular-nums">
                        {d.preVoters} ({d.preYes})
                      </td>
                      <td className="py-2 text-right tabular-nums">{d.turnoutPct === null ? "–" : `${d.turnoutPct}%`}</td>
                      <td className="py-2 text-right tabular-nums">
                        {d.eoiCount} · {gbp(d.eoiGbp)}
                      </td>
                      <td className="py-2 text-right tabular-nums" title={`${formatGbp(d.paidGbp)} paid`}>
                        {gbp(d.ticketGbp)}
                        {d.raiseGbp ? <span className="text-black/45"> / {gbp(d.raiseGbp)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-black/45">Turnout: members who voted in the current vote, out of members who can see deals.</p>
            </div>
          )}
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Ticket sizes" note="Paid tickets, all time.">
            <BarList rows={investment.tickets.buckets} empty="No paid tickets yet." />
            <TableView headers={["Ticket size", "Tickets"]} rows={investment.tickets.buckets.map((b) => [b.label, b.value])} />
          </Panel>
          <Panel title="Invested each year" note="Paid tickets, by the year they were paid.">
            {investment.byYear.length === 0 ? (
              <p className="text-sm text-black/50">No paid tickets yet.</p>
            ) : (
              <ColumnChart title="Invested each year" points={investment.byYear} format={gbp} partialLast="this year so far" />
            )}
          </Panel>
        </div>
      </Section>

      {/* Dealflow */}
      <Section title="Dealflow" note="Deals coming in, how far they get, how long each stage takes, and why deals are declined.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="New deals" value={dealflow.newDeals} note={`in ${periodLabel}`} href="/deals" />
          <StatTile label="Submitted → invested" value={`${dealflow.conversionPct}%`} note="of deals tracked in DXV OS" />
          <StatTile label="Invested deals" value={dealflow.investedDeals} href="/portfolio" />
          <StatTile label="Declined" value={dealflow.declined} note="kept for learning" href="/deals?declined=1" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Deals coming in, by month">
            <ColumnChart title="Deals coming in, by month" points={dealflow.byMonth} partialLast="this month so far" unit="deals" />
          </Panel>
          <Panel title="How far deals get" note="Deals that reached each stage (declined deals count up to where they stopped).">
            <BarList rows={dealflow.reach} />
            <TableView headers={["Stage", "Deals"]} rows={dealflow.reach.map((r) => [r.label, r.value])} />
          </Panel>
          <Panel title="Typical days in each stage" note="Median, for deals that have moved on from the stage.">
            {dealflow.daysInStage.every((d) => d.days === null) ? (
              <p className="text-sm text-black/50">Not enough stage history yet.</p>
            ) : dealflow.daysInStage.every((d) => !d.days) ? (
              <p className="text-sm text-black/50">So far, deals have moved through each stage in under a day.</p>
            ) : (
              <BarList rows={dealflow.daysInStage.filter((d) => d.days !== null).map((d) => ({ label: d.label, value: d.days! }))} format={(n) => (n === 0 ? "<1d" : `${n}d`)} />
            )}
          </Panel>
          <Panel title="Why deals were declined">
            <BarList rows={dealflow.declineReasons} empty="No declined deals yet." />
          </Panel>
        </div>
        <Panel title="How founders heard about DXV" note={`From ${dealflow.websiteSubmissions} website ${dealflow.websiteSubmissions === 1 ? "application" : "applications"} in ${periodLabel}.`}>
          <BarList rows={dealflow.founderSources} empty="No website applications in this period yet." />
          <TableView headers={["Source", "Applications"]} rows={dealflow.founderSources.map((s) => [s.label, s.value])} />
        </Panel>
        <Panel title="Founder diversity of invested deals" note="From each deal's founder diversity (what founders have stated).">
          <BarList rows={dealflow.diversity} empty="No themes recorded on invested deals yet." />
        </Panel>
      </Section>

      <p className="text-xs text-black/45">
        Visits are counted from when tracking began (1 Oct 2026): which part of the portal a member opened and when, nothing else. Partners&apos; own portal
        visits are left out, and nothing in members&apos; private My Portfolio is ever counted.
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-dxv-green/15 pb-2">
        <h2 className="text-xl font-semibold text-dxv-green">{title}</h2>
        <p className="text-sm text-black/55">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h3>
        {note && <p className="text-xs text-black/50">{note}</p>}
      </div>
      {children}
    </div>
  );
}
