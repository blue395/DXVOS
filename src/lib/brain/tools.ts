// The DXV Brain's tools: read-only lookups into DXV OS. There are deliberately no
// write tools: the Brain can read everything and change nothing (Blue, 2026-10-02).
//
// Plain SQL via `pg` (shared with the Netlify worker, like the other AI workers):
// relative imports only, no "server-only".
import type Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import type { EligibilityScreen } from "../deck-ai/schema";
import { renderScreen } from "../deck-ai/render";
import type { MemoContent } from "../memo-ai/schema";
import { renderMemo } from "../memo-ai/render";
import { ALL_STAGES, formatGbp, PASS_REASON_LABELS, stageLabel } from "../pipeline";
import type { PassReason, Stage } from "../../generated/prisma/enums";

type Tool = Anthropic.Beta.BetaTool;
type ToolContent = string | Anthropic.Beta.BetaToolResultBlockParam["content"];

const dealArg = {
  deal: { type: "string", description: "The deal's id (from the page note or list_deals) or its company name." },
} as const;

/** Anthropic's web search, run on Anthropic's servers; results come back with citations. */
export const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 5 } as const;

export const BRAIN_TOOLS: Tool[] = [
  {
    name: "list_deals",
    description:
      "List DXV's deals with stage, round, sector, company stage, raise, lead angel and days in stage. Use it to find a deal, or for questions across the pipeline. Declined deals are excluded unless include_declined is true.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional: part of a company name, founder name or sector." },
        stage: { type: "string", description: "Optional: a stage name, e.g. \"Due Diligence\"." },
        round: { type: "integer", description: "Optional: DXV round number." },
        include_declined: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_deal",
    description:
      "Everything DXV OS holds on one deal: details, stage history, eligibility screen and decisions, memo status and scores, pre-selection votes, EOIs, final investments, DD checklist, founder comms, documents and lessons from it.",
    input_schema: { type: "object", properties: dealArg, required: ["deal"], additionalProperties: false },
  },
  {
    name: "get_memo",
    description:
      "The full text of a deal's investment memo: the latest DXV Review Issue if there is one, else the working DXV Review Draft, else the latest AI Draft.",
    input_schema: { type: "object", properties: dealArg, required: ["deal"], additionalProperties: false },
  },
  {
    name: "get_dd_plan",
    description: "The latest AI-drafted due diligence plan for a deal (areas, questions, requested documents, red flags).",
    input_schema: { type: "object", properties: dealArg, required: ["deal"], additionalProperties: false },
  },
  {
    name: "read_deck",
    description: "Read the deal's latest pitch deck (the stored PDF). Use it for questions the other records don't answer.",
    input_schema: { type: "object", properties: dealArg, required: ["deal"], additionalProperties: false },
  },
  {
    name: "pipeline_overview",
    description: "Pipeline totals: deals per stage, deals in DD, EOI totals, invested total (paid final tickets), founder comms owed.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "recent_activity",
    description: "Stage moves across all deals in the last N days (default 14), newest first, with who moved them and notes.",
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "How many days back (1 to 90)." } },
      additionalProperties: false,
    },
  },
];

/** A short label for the chat while a tool runs. */
export function toolActivity(name: string): string {
  switch (name) {
    case "list_deals":
      return "Looking through the pipeline";
    case "get_deal":
      return "Reading the deal in DXV OS";
    case "get_memo":
      return "Reading the memo";
    case "get_dd_plan":
      return "Reading the DD plan";
    case "read_deck":
      return "Reading the pitch deck";
    case "pipeline_overview":
      return "Checking pipeline totals";
    case "recent_activity":
      return "Checking recent activity";
    case "web_search":
      return "Searching the web";
    default:
      return "Working";
  }
}

export type BrainToolDeps = { pool: Pool; readDeck: (storagePath: string) => Promise<Buffer> };

export class BrainToolError extends Error {}

const d = (x: Date | string | null | undefined) =>
  x ? new Date(x).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "";
const gbp = (n: number | null | undefined) => (n == null ? "" : formatGbp(n));
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

type DealRow = { id: string; name: string; currentStage: Stage };

/** Find one deal by id or (part of) its name. Throws a helpful error when ambiguous. */
async function findDeal(pool: Pool, ref: string): Promise<DealRow> {
  const r = ref.trim();
  if (!r) throw new BrainToolError("Say which deal (its id or name).");
  const byId = await pool.query<DealRow>(`SELECT id, name, "currentStage" FROM "Venture" WHERE id = $1`, [r]);
  if (byId.rows[0]) return byId.rows[0];
  const byName = await pool.query<DealRow>(
    `SELECT id, name, "currentStage" FROM "Venture" WHERE name ILIKE $1 ORDER BY (lower(name) = lower($2)) DESC, "updatedAt" DESC LIMIT 6`,
    [`%${r.replace(/[%_]/g, "")}%`, r],
  );
  const exact = byName.rows.filter((x) => x.name.toLowerCase() === r.toLowerCase());
  if (exact.length === 1 || byName.rows.length === 1) return exact[0] ?? byName.rows[0];
  if (!byName.rows.length) throw new BrainToolError(`No deal matches "${r}". Try list_deals.`);
  throw new BrainToolError(`Several deals match "${r}": ${byName.rows.map((x) => `${x.name} (id ${x.id})`).join("; ")}. Use the id.`);
}

export async function runBrainTool(name: string, input: Record<string, unknown>, deps: BrainToolDeps): Promise<ToolContent> {
  switch (name) {
    case "list_deals":
      return listDeals(deps.pool, input);
    case "get_deal":
      return getDeal(deps.pool, await findDeal(deps.pool, str(input.deal)));
    case "get_memo":
      return getMemo(deps.pool, await findDeal(deps.pool, str(input.deal)));
    case "get_dd_plan":
      return getDDPlan(deps.pool, await findDeal(deps.pool, str(input.deal)));
    case "read_deck":
      return readDeckTool(deps, await findDeal(deps.pool, str(input.deal)));
    case "pipeline_overview":
      return pipelineOverview(deps.pool);
    case "recent_activity":
      return recentActivity(deps.pool, Number(input.days) || 14);
    default:
      throw new BrainToolError(`Unknown tool ${name}.`);
  }
}

async function listDeals(pool: Pool, input: Record<string, unknown>): Promise<string> {
  const search = str(input.search);
  const stageName = str(input.stage).toLowerCase();
  const round = Number.isInteger(input.round) ? (input.round as number) : null;
  const rows = (
    await pool.query<{
      id: string;
      name: string;
      currentStage: Stage;
      round: number | null;
      sector: string | null;
      companyStage: string | null;
      raiseAmountGbp: number | null;
      leadAngel: string | null;
      founderNames: string | null;
      stageEnteredAt: Date;
      passedFromStage: Stage | null;
    }>(
      `SELECT id, name, "currentStage", round, sector, "companyStage", "raiseAmountGbp", "leadAngel", "founderNames", "stageEnteredAt", "passedFromStage"
       FROM "Venture"
       WHERE ($1::boolean OR "currentStage" <> 'PASSED')
         AND ($2::text = '' OR name ILIKE '%' || $2 || '%' OR "founderNames" ILIKE '%' || $2 || '%' OR sector ILIKE '%' || $2 || '%')
         AND ($3::int IS NULL OR round = $3)
       ORDER BY "stageEnteredAt" ASC LIMIT 200`,
      [input.include_declined === true || stageName === "declined", search, round],
    )
  ).rows.filter((v) => !stageName || stageLabel(v.currentStage).toLowerCase().includes(stageName));
  if (!rows.length) return "No deals match.";
  const now = Date.now();
  return (
    `${rows.length} deal(s):\n` +
    rows
      .map((v) =>
        [
          `- ${v.name} (id ${v.id})`,
          stageLabel(v.currentStage) + (v.passedFromStage ? ` at ${stageLabel(v.passedFromStage)}` : ""),
          `${Math.floor((now - new Date(v.stageEnteredAt).getTime()) / 86400000)}d in stage`,
          v.round ? `Round ${v.round}` : "",
          v.companyStage ?? "",
          v.sector ?? "",
          v.raiseAmountGbp ? `raising ${gbp(v.raiseAmountGbp)}` : "",
          v.founderNames ? `founders: ${v.founderNames}` : "",
          v.leadAngel ? `lead ${v.leadAngel}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      )
      .join("\n")
  );
}

async function getDeal(pool: Pool, deal: DealRow): Promise<string> {
  const id = deal.id;
  const q = <T extends object>(sql: string) => pool.query<T>(sql, [id]).then((r) => r.rows);
  const [[v], history, screens, reviews, memos, preVotes, eois, finals, ddItems, comms, docs, lessons] = await Promise.all([
    q<Record<string, unknown>>(`SELECT * FROM "Venture" WHERE id = $1`),
    q<{ fromStage: Stage | null; toStage: Stage; note: string | null; passReason: PassReason | null; changedAt: Date; by: string | null }>(
      `SELECT s."fromStage", s."toStage", s.note, s."passReason", s."changedAt", u.name AS by FROM "StageChange" s LEFT JOIN "User" u ON u.id = s."changedById" WHERE s."ventureId" = $1 ORDER BY s."changedAt"`,
    ),
    q<{ screen: EligibilityScreen; fileName: string; completedAt: Date }>(
      `SELECT screen, "fileName", "completedAt" FROM "DeckAnalysis" WHERE "ventureId" = $1 AND status = 'COMPLETE' AND screen IS NOT NULL ORDER BY "completedAt" DESC LIMIT 1`,
    ),
    q<{ decision: string; passReason: PassReason | null; note: string | null; decidedAt: Date; by: string }>(
      `SELECT r.decision, r."passReason", r.note, r."decidedAt", u.name AS by FROM "EligibilityReview" r JOIN "User" u ON u.id = r."decidedById" WHERE r."ventureId" = $1 ORDER BY r."decidedAt"`,
    ),
    q<{ kind: string; label: string; content: MemoContent | null; at: Date }>(
      `(SELECT 'issue' AS kind, 'DXV Review Issue ' || version AS label, content, "createdAt" AS at FROM "MemoVersion" WHERE "ventureId" = $1 AND kind = 'REVIEWED_MEMO')
       UNION ALL (SELECT 'draft', 'DXV Review Draft ' || number, content, "updatedAt" FROM "MemoDraft" WHERE "ventureId" = $1 AND "archivedAt" IS NULL)
       UNION ALL (SELECT 'ai', 'AI Draft ' || number, output, "completedAt" FROM "MemoAnalysis" WHERE "ventureId" = $1 AND status = 'COMPLETE')
       ORDER BY at DESC`,
    ),
    q<{ angelName: string; interested: boolean; note: string | null; createdAt: Date }>(
      `SELECT "angelName", interested, note, "createdAt" FROM "PreSelectionVote" WHERE "ventureId" = $1 ORDER BY "createdAt"`,
    ),
    q<{ angelName: string; interested: boolean; maxTicketGbp: number; note: string | null; createdAt: Date }>(
      `SELECT "angelName", interested, "maxTicketGbp", note, "createdAt" FROM "InvestmentVote" WHERE "ventureId" = $1 AND "removedAt" IS NULL ORDER BY "createdAt"`,
    ),
    q<{ angelName: string; ticketGbp: number; paidAt: Date | null; note: string | null }>(
      `SELECT "angelName", "ticketGbp", "paidAt", note FROM "FinalInvestment" WHERE "ventureId" = $1 AND "removedAt" IS NULL ORDER BY "createdAt"`,
    ),
    q<{ title: string; owner: string | null; dueDate: Date | null; completedAt: Date | null }>(
      `SELECT title, owner, "dueDate", "completedAt" FROM "DDItem" WHERE "ventureId" = $1 ORDER BY "createdAt"`,
    ),
    q<{ gate: string; decision: string; status: string; sentAt: Date | null; note: string | null }>(
      `SELECT gate, decision, status, "sentAt", note FROM "FounderComm" WHERE "ventureId" = $1 ORDER BY "createdAt"`,
    ),
    q<{ fileName: string; category: string; uploadedAt: Date | null }>(
      `SELECT "fileName", category, "uploadedAt" FROM "Document" WHERE "ventureId" = $1 AND "archivedAt" IS NULL AND "uploadedAt" IS NOT NULL ORDER BY "uploadedAt"`,
    ),
    q<{ title: string; body: string; status: string }>(`SELECT title, body, status FROM "Lesson" WHERE "ventureId" = $1 AND status <> 'ARCHIVED'`),
  ]);

  const lines: string[] = [`# ${v.name} (id ${id})`];
  const field = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") lines.push(`${label}: ${value}`);
  };
  field("Stage", stageLabel(v.currentStage as Stage) + ` (since ${d(v.stageEnteredAt as Date)})`);
  if (v.currentStage === "PASSED") {
    field("Declined at", v.passedFromStage ? stageLabel(v.passedFromStage as Stage) : "");
    field("Decline reason", v.passReason ? PASS_REASON_LABELS[v.passReason as PassReason] : "");
    field("Decline note", v.passNote);
  }
  field("Founders", v.founderNames);
  field("Founder email", v.founderEmail);
  field("Website", v.website);
  field("Sector", v.sector);
  field("Company stage", v.companyStage);
  field("Raise", v.raiseAmountGbp ? gbp(v.raiseAmountGbp as number) : "");
  field("DXV round", v.round ? `Round ${v.round}` : "");
  field("Lead angel", v.leadAngel);
  field("Description", v.description);
  field("Added", d(v.createdAt as Date));

  lines.push("", "## Stage history");
  for (const h of history)
    lines.push(
      `- ${d(h.changedAt)}: ${h.fromStage ? `${stageLabel(h.fromStage)} to ` : "created at "}${stageLabel(h.toStage)}${h.by ? ` by ${h.by}` : ""}${h.passReason ? ` (${PASS_REASON_LABELS[h.passReason]})` : ""}${h.note ? `. "${h.note}"` : ""}`,
    );

  lines.push("", "## Eligibility screen");
  if (screens[0]) lines.push(`AI screen of ${screens[0].fileName}, ${d(screens[0].completedAt)}:`, renderScreen(screens[0].screen));
  else lines.push("No eligibility screen yet.");
  for (const r of reviews) lines.push(`- Decision ${d(r.decidedAt)} by ${r.by}: ${r.decision}${r.passReason ? ` (${PASS_REASON_LABELS[r.passReason]})` : ""}${r.note ? `. ${r.note}` : ""}`);

  lines.push("", "## Investment assessment and memo");
  if (!memos.length) lines.push("No memo yet.");
  for (const m of memos.slice(0, 6)) {
    const scores = m.content?.scores ?? [];
    const total = scores.reduce((a, s) => a + (s.score ?? 0), 0);
    lines.push(`- ${m.label} (${d(m.at)})${scores.length ? `: total ${total}/${scores.length * 5}` : ""}`);
  }
  if (memos.length) lines.push("Use get_memo for the full text.");

  lines.push("", "## Pre-selection votes (interest only)");
  lines.push(preVotes.length ? preVotes.map((p) => `- ${p.angelName}: ${p.interested ? "interested" : "not interested"}${p.note ? ` (${p.note})` : ""}`).join("\n") : "None.");

  lines.push("", "## EOIs (investment commitments)");
  if (eois.length) {
    for (const e of eois) lines.push(`- ${e.angelName}: ${e.interested ? `up to ${gbp(e.maxTicketGbp)}` : "not interested"}${e.note ? ` (${e.note})` : ""}, ${d(e.createdAt)}`);
    lines.push(`Total interested: ${gbp(eois.filter((e) => e.interested).reduce((a, e) => a + e.maxTicketGbp, 0))} (if an angel has several entries, their latest counts)`);
  } else lines.push("None.");

  lines.push("", "## Final investment");
  if (finals.length) {
    for (const f of finals) lines.push(`- ${f.angelName}: ${gbp(f.ticketGbp)}, ${f.paidAt ? `paid ${d(f.paidAt)}` : "not yet paid"}${f.note ? ` (${f.note})` : ""}`);
  } else lines.push("None.");

  lines.push("", "## Due diligence checklist");
  lines.push(
    ddItems.length
      ? ddItems.map((i) => `- [${i.completedAt ? "x" : " "}] ${i.title}${i.owner ? `, owner ${i.owner}` : ""}${i.dueDate ? `, due ${d(i.dueDate)}` : ""}`).join("\n")
      : "No DD items.",
  );

  lines.push("", "## Founder comms");
  lines.push(comms.length ? comms.map((c) => `- ${c.gate}: "${c.decision}", ${c.status.replace(/_/g, " ").toLowerCase()}${c.sentAt ? ` ${d(c.sentAt)}` : ""}${c.note ? ` (${c.note})` : ""}`).join("\n") : "None owed yet.");

  lines.push("", "## Documents stored in DXV OS");
  lines.push(docs.length ? docs.map((x) => `- ${x.fileName} (${x.category.replace(/_/g, " ").toLowerCase()}, ${d(x.uploadedAt)})`).join("\n") : "None.");

  if (lessons.length) {
    lines.push("", "## Lessons from this deal");
    for (const l of lessons) lines.push(`- ${l.title} (${l.status.toLowerCase()}): ${l.body}`);
  }
  return lines.join("\n");
}

async function getMemo(pool: Pool, deal: DealRow): Promise<string> {
  const { rows } = await pool.query<{ label: string; content: MemoContent | null; at: Date }>(
    `SELECT * FROM (
       (SELECT 1 AS rank, 'DXV Review Issue ' || version AS label, content, "createdAt" AS at FROM "MemoVersion" WHERE "ventureId" = $1 AND kind = 'REVIEWED_MEMO' ORDER BY version DESC LIMIT 1)
       UNION ALL (SELECT 2, 'DXV Review Draft ' || number, content, "updatedAt" FROM "MemoDraft" WHERE "ventureId" = $1 AND "archivedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 1)
       UNION ALL (SELECT 3, 'AI Draft ' || number, output, "completedAt" FROM "MemoAnalysis" WHERE "ventureId" = $1 AND status = 'COMPLETE' ORDER BY number DESC LIMIT 1)
     ) m ORDER BY rank LIMIT 1`,
    [deal.id],
  );
  const m = rows[0];
  if (!m?.content) return `${deal.name} has no memo in DXV OS yet.`;
  return `${m.label} for ${deal.name} (${d(m.at)}):\n\n${renderMemo(m.content, { banner: false })}`;
}

async function getDDPlan(pool: Pool, deal: DealRow): Promise<string> {
  const { rows } = await pool.query<{ output: unknown; completedAt: Date }>(
    `SELECT output, "completedAt" FROM "DDReportJob" WHERE "ventureId" = $1 AND status = 'COMPLETE' AND output IS NOT NULL ORDER BY "completedAt" DESC LIMIT 1`,
    [deal.id],
  );
  if (!rows[0]) return `${deal.name} has no AI DD plan yet.`;
  return `AI-drafted DD plan for ${deal.name} (${d(rows[0].completedAt)}), as JSON:\n${JSON.stringify(rows[0].output)}`;
}

/** Marker for a deck in a stored chat: the PDF itself isn't saved in the chat, only where it lives. */
export const DECK_MARKER = "dxv_deck";

async function readDeckTool(deps: BrainToolDeps, deal: DealRow): Promise<ToolContent> {
  const { rows } = await deps.pool.query<{ storagePath: string; fileName: string }>(
    `SELECT "storagePath", "fileName" FROM "DeckAnalysis" WHERE "ventureId" = $1 AND status IN ('COMPLETE', 'FAILED', 'PROCESSING') ORDER BY "createdAt" DESC LIMIT 1`,
    [deal.id],
  );
  const deck = rows[0];
  if (!deck) return `${deal.name} has no deck stored in DXV OS.`;
  const pdf = await deps.readDeck(deck.storagePath);
  return [
    { type: "text", text: `${deal.name}'s pitch deck (${deck.fileName}):` },
    {
      type: "document",
      title: deck.fileName,
      source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
      // Where the PDF lives, so the stored chat can hold a pointer instead of the file.
      context: `${DECK_MARKER}:${deck.storagePath}`,
    },
  ];
}

async function pipelineOverview(pool: Pool): Promise<string> {
  const [stages, eoi, invested, comms] = await Promise.all([
    pool.query<{ currentStage: Stage; n: number; raise: number | null }>(
      `SELECT "currentStage", count(*)::int AS n, sum("raiseAmountGbp")::int AS raise FROM "Venture" GROUP BY "currentStage"`,
    ),
    pool.query<{ total: number | null; deals: number }>(
      `SELECT sum(t."maxTicketGbp")::int AS total, count(DISTINCT t."ventureId")::int AS deals FROM (
         SELECT DISTINCT ON ("ventureId", lower(trim("angelName"))) "ventureId", "maxTicketGbp", interested
         FROM "InvestmentVote" WHERE "removedAt" IS NULL ORDER BY "ventureId", lower(trim("angelName")), "createdAt" DESC
       ) t JOIN "Venture" v ON v.id = t."ventureId" WHERE t.interested AND v."currentStage" <> 'PASSED'`,
    ),
    pool.query<{ total: number | null; deals: number }>(
      `SELECT sum(f."ticketGbp")::int AS total, count(DISTINCT f."ventureId")::int AS deals FROM "FinalInvestment" f JOIN "Venture" v ON v.id = f."ventureId"
       WHERE f."removedAt" IS NULL AND f."paidAt" IS NOT NULL AND v."currentStage" IN ('INVESTMENT_COMPLETE', 'SEIS_CERTIFICATE')`,
    ),
    pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "FounderComm" WHERE status = 'NOT_YET_SENT'`),
  ]);
  return [
    "Deals per stage:",
    ...[...stages.rows].sort((x, y) => ALL_STAGES.findIndex((s) => s.key === x.currentStage) - ALL_STAGES.findIndex((s) => s.key === y.currentStage)).map((s) => `- ${stageLabel(s.currentStage)}: ${s.n}${s.raise ? ` (raises total ${gbp(s.raise)})` : ""}`),
    `Live EOIs (latest per angel, interested, on live deals): ${gbp(eoi.rows[0]?.total ?? 0)} across ${eoi.rows[0]?.deals ?? 0} deal(s)`,
    `Invested (paid final tickets on completed deals): ${gbp(invested.rows[0]?.total ?? 0)} across ${invested.rows[0]?.deals ?? 0} deal(s)`,
    `Founder comms owed: ${comms.rows[0]?.n ?? 0}`,
  ].join("\n");
}

async function recentActivity(pool: Pool, days: number): Promise<string> {
  const n = Math.min(90, Math.max(1, Math.round(days)));
  const { rows } = await pool.query<{ name: string; fromStage: Stage | null; toStage: Stage; note: string | null; changedAt: Date; by: string | null }>(
    `SELECT v.name, s."fromStage", s."toStage", s.note, s."changedAt", u.name AS by FROM "StageChange" s
     JOIN "Venture" v ON v.id = s."ventureId" LEFT JOIN "User" u ON u.id = s."changedById"
     WHERE s."changedAt" > now() - make_interval(days => $1) ORDER BY s."changedAt" DESC LIMIT 100`,
    [n],
  );
  if (!rows.length) return `No stage moves in the last ${n} days.`;
  return rows
    .map((r) => `- ${d(r.changedAt)}: ${r.name} ${r.fromStage ? `${stageLabel(r.fromStage)} to ` : "created at "}${stageLabel(r.toStage)}${r.by ? ` by ${r.by}` : ""}${r.note ? `. "${r.note}"` : ""}`)
    .join("\n");
}
