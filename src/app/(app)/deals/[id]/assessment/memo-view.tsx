// Read-only memo in DXV's template order. Server-component safe.
import { MAX_TOTAL_SCORE, totalScore, type MemoContent, type MemoScore } from "@/lib/memo-ai/schema";
import { REVIEW_BANNER } from "@/lib/memo-ai/render";

export function ReviewBanner() {
  return (
    <div role="note" className="rounded-md border-2 border-dxv-yellow bg-dxv-yellow/20 px-4 py-3 text-sm text-dxv-green">
      <p className="font-semibold">{REVIEW_BANNER[0]}</p>
      <p>{REVIEW_BANNER[1]}</p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-black/50">None</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  // Brand-only scale: higher scores get stronger green.
  const cls = score >= 4 ? "bg-dxv-green text-white" : score === 3 ? "bg-dxv-green/15 text-dxv-green" : "bg-dxv-yellow text-dxv-green";
  return <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${cls}`}>{score}</span>;
}

export function TotalScore({ scores }: { scores: MemoScore[] }) {
  return (
    <span className="rounded-full bg-dxv-green px-3 py-1 text-sm font-semibold text-white">
      {totalScore(scores)}
      <span className="text-dxv-yellow">/{MAX_TOTAL_SCORE}</span>
    </span>
  );
}

export function MemoHeader({ m }: { m: MemoContent }) {
  const h = m.header;
  const rows: [string, string][] = [
    ["Business name", h.businessName],
    ["Round", h.round],
    ["Stage", h.stage],
    ["Business model", h.businessModel],
    ["SDGs", h.sdgs.join("; ") || "None"],
    ["Impact thesis", h.impactThesis],
    ["Impact themes", h.impactThemes.join(", ") || "None"],
    ["Diversity themes", h.diversityThemes.join(", ") || "Not stated"],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-1.5 rounded-lg border border-black/10 bg-dxv-green/[0.03] p-4 text-sm sm:grid-cols-[150px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-black/60">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SwotGrid({ m }: { m: MemoContent }) {
  const cells: [string, string[]][] = [
    ["Strengths", m.swot.strengths],
    ["Weaknesses", m.swot.weaknesses],
    ["Opportunities", m.swot.opportunities],
    ["Threats", m.swot.threats],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cells.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-black/10 p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/55">{k}</h3>
          <Bullets items={v} />
        </div>
      ))}
    </div>
  );
}

/** The full memo, read-only. `aiScores` (optional) shows the AI's original score beside each. */
export function MemoView({ m, aiScores }: { m: MemoContent; aiScores?: MemoScore[] }) {
  return (
    <div className="space-y-6">
      <MemoHeader m={m} />
      <Section title="Executive summary">
        <p className="whitespace-pre-wrap text-sm">{m.executiveSummary}</p>
      </Section>
      <Section title="Investment case">
        <Bullets items={m.investmentCase} />
      </Section>
      <Section title="Conclusion">
        <p className="whitespace-pre-wrap text-sm">{m.conclusion}</p>
      </Section>
      <Section title="Scoring">
        <div className="mb-2">
          <TotalScore scores={m.scores} />
        </div>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-black/10">
            {m.scores.map((s) => {
              const ai = aiScores?.find((a) => a.criterion === s.criterion);
              return (
                <tr key={s.criterion} className={ai && ai.score !== s.score ? "bg-dxv-yellow/15" : ""}>
                  <td className="w-44 py-2 pr-3 align-top font-medium">{s.criterion}</td>
                  <td className="w-14 py-2 align-top">
                    <ScoreBadge score={s.score} />
                  </td>
                  <td className="py-2 align-top text-black/75">
                    {s.justification}
                    {ai && ai.score !== s.score && <span className="ml-1 text-xs text-black/50">(AI scored {ai.score})</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
      <Section title="SWOT summary">
        <SwotGrid m={m} />
      </Section>
      <Section title="Key follow-up questions for founders">
        <Bullets items={m.followUpQuestions} />
      </Section>
    </div>
  );
}
