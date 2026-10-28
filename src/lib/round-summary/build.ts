// Assembling, editing and exporting the Partner Review round summary. Pure; shared with
// the Netlify worker and the Brain's tools (relative imports only).
import { formatLongDate, type Block, type DocSpec } from "../export/spec";
import type { RoundSummaryContext } from "./context";
import { TAKE_TO_PITCH, TAKE_TO_PITCH_LABELS, type RoundSummaryAiOutput, type RoundSummaryContent, type SummaryDeal, type TakeToPitch } from "./schema";

const EMPTY_AI = { headline: "", dealTerms: "Not stated", strengths: [], concerns: [], dxvFit: "", impactThemes: [], diversityThemes: [], keyQuestion: "" };

/**
 * The working copy for a new summary: the AI's text per deal (in the context's order), plus
 * the partners' view and "Take to pitch?" carried over from the previous version of the
 * same round, matched by deal, so regenerating never loses what the partners wrote.
 */
export function buildSummaryContent(ctx: RoundSummaryContext, ai: RoundSummaryAiOutput, previous: RoundSummaryContent | null): RoundSummaryContent {
  return {
    intro: previous?.intro ?? "",
    deals: ctx.deals.map((d): SummaryDeal => {
      const out = ai.deals.find((x) => x.ventureId === d.ventureId);
      const before = previous?.deals.find((x) => x.ventureId === d.ventureId);
      return {
        ventureId: d.ventureId,
        name: d.name,
        facts: d.facts,
        ...(out?.summary ?? EMPTY_AI),
        error: out?.summary ? null : (out?.error ?? "Not summarised."),
        partnerView: before?.partnerView ?? "",
        takeToPitch: before?.takeToPitch ?? null,
      };
    }),
  };
}

/** The round the picker opens on: the one with most deals at DXV Partner Review (ties: the latest round). */
export function defaultSummaryRound(ventures: { round: number | null; currentStage: string }[]): number | null {
  const counts = new Map<number, number>();
  for (const v of ventures) if (v.round !== null && v.currentStage === "PARTNER_REVIEW") counts.set(v.round, (counts.get(v.round) ?? 0) + 1);
  let best: number | null = null;
  for (const [round, n] of counts) if (best === null || n > counts.get(best)! || (n === counts.get(best)! && round > best)) best = round;
  return best;
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

/**
 * Apply the editor's form to the working copy. Fields are named `<ventureId>.<field>`; deals
 * and facts come from the stored copy (never the form). `themes(name)` reads a ThemePills field.
 */
export function applySummaryEdits(content: RoundSummaryContent, get: (name: string) => string | null, themes: (name: string) => string[]): RoundSummaryContent {
  const take = (v: string | null): TakeToPitch | null => ((TAKE_TO_PITCH as readonly string[]).includes(v ?? "") ? (v as TakeToPitch) : null);
  return {
    intro: (get("intro") ?? content.intro).trim(),
    deals: content.deals.map((d) => {
      const f = (k: string) => get(`${d.ventureId}.${k}`);
      const text = (k: string, cur: string) => f(k)?.trim() ?? cur;
      return {
        ...d,
        headline: text("headline", d.headline),
        dealTerms: text("dealTerms", d.dealTerms),
        strengths: f("strengths") !== null ? lines(f("strengths")!) : d.strengths,
        concerns: f("concerns") !== null ? lines(f("concerns")!) : d.concerns,
        dxvFit: text("dxvFit", d.dxvFit),
        impactThemes: f("impactThemesOther") !== null ? themes(`${d.ventureId}.impactThemes`) : d.impactThemes,
        diversityThemes: f("diversityThemesOther") !== null ? themes(`${d.ventureId}.diversityThemes`) : d.diversityThemes,
        keyQuestion: text("keyQuestion", d.keyQuestion),
        partnerView: text("partnerView", d.partnerView),
        takeToPitch: f("takeToPitch") !== null ? take(f("takeToPitch")) : d.takeToPitch,
      };
    }),
  };
}

export const takeLabel = (t: TakeToPitch | null) => (t ? TAKE_TO_PITCH_LABELS[t] : "Not decided");
const list = (xs: string[], empty = "None") => (xs.length ? xs.join(", ") : empty);

export type SummaryMeta = { round: number; number: number; date: Date; editedBy: string | null; aiOnly: boolean };

export const summaryName = (number: number) => `Summary ${number}`;

/** The branded PDF / Word document (same layout as the memo and DD exports). */
export function roundSummarySpec(c: RoundSummaryContent, meta: SummaryMeta): DocSpec {
  const tally = TAKE_TO_PITCH.map((t) => `${TAKE_TO_PITCH_LABELS[t]} ${c.deals.filter((d) => d.takeToPitch === t).length}`).join(" · ");
  const blocks: Block[] = [
    ...(c.intro ? ([{ kind: "paragraph", text: c.intro }] as Block[]) : []),
    { kind: "heading", text: "Round at a glance" },
    {
      kind: "table",
      headers: ["Company", "Sector", "Stage", "Raise", "Eligibility", "Memo score", "Take to pitch?"],
      rows: c.deals.map((d) => [
        d.name,
        d.facts.sector ?? "",
        d.facts.stage ?? "",
        d.facts.raise ?? "",
        d.facts.eligibility ?? "",
        d.facts.memoScore ?? "",
        takeLabel(d.takeToPitch),
      ]),
      widths: [0.2, 0.13, 0.11, 0.11, 0.17, 0.13, 0.15],
    },
  ];
  for (const d of c.deals) {
    blocks.push(
      { kind: "heading", text: d.name },
      ...(d.facts.oneLiner ? ([{ kind: "paragraph", text: d.facts.oneLiner, italic: true }] as Block[]) : []),
      ...(d.error && !d.headline ? ([{ kind: "notice", text: `Not summarised by the AI: ${d.error}` }] as Block[]) : []),
      { kind: "paragraph", text: d.headline || "No headline yet." },
      {
        kind: "keyValue",
        rows: [
          ["Deal terms", d.dealTerms],
          ["Impact themes", list(d.impactThemes)],
          ["Diversity themes", list(d.diversityThemes, "Not stated")],
        ],
      },
      { kind: "subheading", text: "Strengths" },
      { kind: "bullets", items: d.strengths, empty: "None noted." },
      { kind: "subheading", text: "Concerns" },
      { kind: "bullets", items: d.concerns, empty: "None noted." },
      { kind: "subheading", text: "DXV fit" },
      { kind: "paragraph", text: d.dxvFit || "Not assessed yet." },
      { kind: "subheading", text: "Key open question" },
      { kind: "paragraph", text: d.keyQuestion || "None noted." },
      { kind: "subheading", text: `Partner view · Take to pitch? ${takeLabel(d.takeToPitch)}` },
      d.partnerView ? { kind: "paragraph", text: d.partnerView } : { kind: "box", title: "Partner view", prompt: "Comments and decision" },
    );
  }
  blocks.push(
    { kind: "spacer" },
    { kind: "paragraph", text: "Confidential: for DXV partners only. Not for circulation to members or founders.", italic: true, muted: true },
  );
  return {
    title: "Partner Review summary",
    subtitle: `Round ${meta.round}`,
    runningHeader: `DXV Partner Review summary  |  Round ${meta.round}  |  Confidential: partners only`,
    notice: meta.aiOnly ? "DRAFT: AI-assisted first pass. Check it before relying on it; the partners decide who pitches." : undefined,
    summary: [
      ["Round", `Round ${meta.round}`],
      ["Deals at DXV Partner Review", String(c.deals.length)],
      ["Take to pitch?", tally],
      ["Version", `${summaryName(meta.number)}, ${formatLongDate(meta.date)}`],
      ["Last edited by", meta.editedBy ?? "Not edited yet (AI draft)"],
    ],
    blocks,
  };
}

/** Plain text, for the DXV Brain. */
export function renderRoundSummary(c: RoundSummaryContent, meta: SummaryMeta): string {
  return [
    `Partner Review summary, Round ${meta.round} (${summaryName(meta.number)}, ${formatLongDate(meta.date)}; ${meta.editedBy ? `last edited by ${meta.editedBy}` : "AI draft, not edited yet"}). Team only.`,
    ...(c.intro ? [c.intro] : []),
    ...c.deals.map((d) =>
      [
        `## ${d.name}${d.facts.oneLiner ? `: ${d.facts.oneLiner}` : ""}`,
        `Sector: ${d.facts.sector ?? "?"} · Stage: ${d.facts.stage ?? "?"} · Raise: ${d.facts.raise ?? "?"} · Eligibility: ${d.facts.eligibility ?? "?"} · Memo score: ${d.facts.memoScore ?? "none"}`,
        d.headline,
        `Deal terms: ${d.dealTerms}`,
        `Strengths:\n${d.strengths.map((s) => `- ${s}`).join("\n") || "- None noted"}`,
        `Concerns:\n${d.concerns.map((s) => `- ${s}`).join("\n") || "- None noted"}`,
        `DXV fit: ${d.dxvFit}`,
        `Impact themes: ${list(d.impactThemes)}; diversity themes: ${list(d.diversityThemes, "not stated")}`,
        `Key open question: ${d.keyQuestion}`,
        `Partner view: ${d.partnerView || "(none yet)"}; take to pitch: ${takeLabel(d.takeToPitch)}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}
