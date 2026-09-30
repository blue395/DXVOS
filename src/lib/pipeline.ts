// Pipeline domain rules — pure functions, no database or UI.
// Everything the board, the deal page and the dashboard need to agree on lives here,
// so there's exactly one definition of "what's a gate", "what counts towards momentum", etc.

import type { AngelStatus, CertificationType, Gate, PassReason, Stage } from "@/generated/prisma/enums";

// ── Stages ──────────────────────────────────────────────────────────────────

export type StageMeta = {
  key: Stage;
  label: string;
  /** Founder is owed a decision when a deal leaves this stage (spec §6). */
  gate?: Gate;
  /** What the founder is told when the deal moves forward past this gate. */
  proceedDecision?: string;
  /** Stages 1–2 are intake (before DXV partner review). */
  intake?: boolean;
  /** Optional final step: not every deal needs it (e.g. no S/EIS relief). */
  optional?: boolean;
};

// Ordered. The index in this array IS the pipeline order.
// Revised 2026-09-28: decision gates at stages 2 to 7. Capital Transfer retired 2026-09-29
// (payments are ticked off in the Final Investment section instead).
export const LINEAR_STAGES: StageMeta[] = [
  { key: "SUBMITTED", label: "Submitted", intake: true },
  {
    key: "ELIGIBILITY_SCREEN",
    label: "Eligibility Screen",
    intake: true,
    gate: "ELIGIBILITY",
    proceedDecision: "Eligible: proceeding to DXV partner review",
  },
  {
    key: "PARTNER_REVIEW",
    label: "DXV Partner Review",
    gate: "PARTNER_REVIEW",
    proceedDecision: "Shortlisted for member pitch selection",
  },
  {
    key: "PITCH_SELECTION",
    label: "Member Pitch Selection",
    gate: "PITCH_SELECTION",
    proceedDecision: "Invited to pitch",
  },
  {
    key: "PITCH_OUTCOME",
    label: "Pitch Outcome",
    gate: "PITCH_OUTCOME",
    proceedDecision: "Proceeding to investment commitments",
  },
  {
    key: "INVESTMENT_COMMITMENTS",
    label: "Investment Commitments",
    gate: "INVESTMENT_COMMITMENTS",
    proceedDecision: "Proceeding to due diligence",
  },
  {
    key: "DUE_DILIGENCE",
    label: "Due Diligence",
    gate: "DUE_DILIGENCE",
    proceedDecision: "Proceeding to investment",
  },
  { key: "INVESTMENT_COMPLETE", label: "Investment Complete" },
  { key: "SEIS_CERTIFICATE", label: "S/EIS Certificate", optional: true },
];

// Stored as PASSED; shown as "Declined" (Blue's wording since 2026-09-29).
export const PASSED_STAGE: StageMeta = { key: "PASSED", label: "Declined", gate: "PASSED" };

/** Every stage a deal can be in today (what the board and stage pickers offer). */
export const ALL_STAGES: StageMeta[] = [...LINEAR_STAGES, PASSED_STAGE];

/** Stages no longer used, kept so old stage history still reads correctly. */
const RETIRED_STAGES: StageMeta[] = [
  { key: "ADD_TO_PIPELINE", label: "Add to pipeline (retired)" },
  { key: "CAPITAL_TRANSFER", label: "Capital Transfer (retired)" },
];

/** The board shows S/EIS Certificate deals in the Investment Complete column (no column of its own). */
export const BOARD_STAGES: StageMeta[] = LINEAR_STAGES.filter((s) => s.key !== "SEIS_CERTIFICATE");

export function boardColumn(stage: Stage): Stage {
  return stage === "SEIS_CERTIFICATE" ? "INVESTMENT_COMPLETE" : stage;
}

/** Dashboard "Deals by stage": the board's stages (S/EIS Certificate counts as Investment Complete) plus Declined. */
export function dealsByStage(stages: Stage[]): (StageMeta & { count: number })[] {
  return [...BOARD_STAGES, PASSED_STAGE].map((s) => ({ ...s, count: stages.filter((st) => boardColumn(st) === s.key).length }));
}

export function stageMeta(stage: Stage): StageMeta {
  const meta = ALL_STAGES.find((s) => s.key === stage) ?? RETIRED_STAGES.find((s) => s.key === stage);
  if (!meta) throw new Error(`Unknown stage ${stage}`);
  return meta;
}

export function stageLabel(stage: Stage): string {
  return stageMeta(stage).label;
}

/** Position in the linear pipeline; PASSED and retired stages have none (-1). */
export function stageIndex(stage: Stage): number {
  return LINEAR_STAGES.findIndex((s) => s.key === stage);
}

/** Deals still being worked on (not passed, and not through to Investment Complete). */
export function isActiveStage(stage: Stage): boolean {
  const i = stageIndex(stage);
  return i >= 0 && i < stageIndex("INVESTMENT_COMPLETE");
}

// ── Gates ───────────────────────────────────────────────────────────────────

export const GATE_LABELS: Record<Gate, string> = {
  ELIGIBILITY: "After Eligibility Screen",
  PARTNER_REVIEW: "After DXV Partner Review",
  PITCH_SELECTION: "After Member Pitch Selection",
  PITCH_OUTCOME: "After Pitch Outcome",
  INVESTMENT_COMMITMENTS: "After Investment Commitments",
  DUE_DILIGENCE: "After Due Diligence",
  PASSED: "Declined",
};

export type OwedComm = { gate: Gate; decision: string };

/**
 * Which founder comms become owed when a deal moves from `from` to `to`.
 *
 * - Moving to PASSED (declined): always owed a response, naming where it was declined.
 * - Moving forward: every gate stage we leave behind is owed its "proceed" message.
 *   (Usually one; more if an admin skips stages.)
 * - Moving backwards, or re-opening from PASSED: nothing new is owed.
 */
export function gatesCrossed(from: Stage | null, to: Stage, passReason?: PassReason | null): OwedComm[] {
  if (to === "PASSED") {
    const why = passReason ? `: ${PASS_REASON_LABELS[passReason]}` : "";
    const at = from && from !== "PASSED" ? ` at ${stageLabel(from)}` : "";
    return [{ gate: "PASSED", decision: `Declined${at}${why}` }];
  }
  if (from === null) return [];

  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(to);
  if (fromIdx < 0 || toIdx <= fromIdx) return []; // from Passed / a retired stage, or backwards

  return LINEAR_STAGES.slice(fromIdx, toIdx)
    .filter((s) => s.gate)
    .map((s) => ({ gate: s.gate!, decision: s.proceedDecision! }));
}

// ── Founder comms ───────────────────────────────────────────────────────────

/**
 * The deal page shows the most recent comm (sent or not) and folds the rest away.
 * `earlierPending` counts hidden comms not yet sent, so the toggle can say so.
 */
export function splitLatestComm<T extends { createdAt: Date; status: string; gate: Gate }>(comms: T[]) {
  // Comms created by one move share a timestamp: then the later gate in the dealflow is the newer one.
  const gateOrder = (g: Gate) => (g === "PASSED" ? Infinity : LINEAR_STAGES.findIndex((s) => s.gate === g));
  const newestFirst = [...comms].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || gateOrder(b.gate) - gateOrder(a.gate));
  const [latest = null, ...earlier] = newestFirst;
  return { latest, earlier, earlierPending: earlier.filter((c) => c.status === "NOT_YET_SENT").length };
}

// ── Declining (stored as PASSED) ────────────────────────────────────────────

/** A deal can be declined at any live stage (not once invested, and not twice). */
export function canDecline(stage: Stage): boolean {
  return isActiveStage(stage);
}

export const PASS_REASON_LABELS: Record<PassReason, string> = {
  INSUFFICIENT_INTEREST: "Insufficient interest",
  DD_FLAG: "DD flag",
  VALUATION_GAP: "Valuation gap",
  FOUNDER_WITHDREW: "Founder withdrew",
  INELIGIBLE: "Ineligible",
  OTHER: "Other",
};

export const PASS_REASONS = Object.keys(PASS_REASON_LABELS) as PassReason[];

// ── Investment commitments (EOI votes) ──────────────────────────────────────
// (The £20k-in-a-week momentum threshold was removed on 2026-09-28: a running total instead.)

/** A deal sitting in Investment Commitments longer than this gets a card warning. */
export const COMMITMENTS_STALL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type EoiLike = { angelName: string; interested: boolean; maxTicketGbp: number; createdAt: Date };

/** Angel names are free text in Week 1, so compare them loosely. */
export function normaliseAngelName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Votes are append-only: an angel can vote several times, and only their most
 * recent vote counts. Returns one vote per angel.
 */
export function latestVotePerAngel<T extends { angelName: string; createdAt: Date }>(votes: T[]): T[] {
  const latest = new Map<string, T>();
  for (const v of votes) {
    const key = normaliseAngelName(v.angelName);
    const current = latest.get(key);
    if (!current || v.createdAt >= current.createdAt) latest.set(key, v);
  }
  return [...latest.values()];
}

/** Running total: each angel's latest vote counts; only "interested" votes add to the total.
 *  (Pass only live entries: removed ones are filtered out by the caller.) */
export function commitmentTotal(votes: EoiLike[]): { totalGbp: number; interestedCount: number } {
  const interested = latestVotePerAngel(votes).filter((v) => v.interested);
  return { totalGbp: sum(interested.map((v) => v.maxTicketGbp)), interestedCount: interested.length };
}

// ── Card warnings (spec §13 — the two drafted conditions) ───────────────────

export type WarningInput = {
  currentStage: Stage;
  stageEnteredAt: Date;
  ddItems: { dueDate: Date | null; completedAt: Date | null }[];
};

export function dealWarnings(v: WarningInput, now: Date = new Date()): string[] {
  const warnings: string[] = [];
  if (v.currentStage === "INVESTMENT_COMMITMENTS" && now.getTime() - v.stageEnteredAt.getTime() > COMMITMENTS_STALL_DAYS * DAY_MS) {
    warnings.push(`In Investment Commitments for over ${COMMITMENTS_STALL_DAYS} days`);
  }
  if (v.currentStage !== "PASSED" && v.ddItems.some((i) => !i.completedAt && i.dueDate && i.dueDate < now)) {
    warnings.push("Overdue DD item");
  }
  return warnings;
}

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

export function formatGbp(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

// ── Eligibility decisions (human-in-the-loop on the AI screen) ──────────────

/** A human can record an eligibility decision while the deal is still at intake. */
export function canDecideEligibility(stage: Stage): boolean {
  return stage === "SUBMITTED" || stage === "ELIGIBILITY_SCREEN";
}

/** The AI screen's recommendation expressed as a decision, to spot when the team decided differently. */
const AI_RECOMMENDATION_AS_DECISION: Record<string, keyof typeof ELIGIBILITY_DECISION_TARGET> = {
  "Proceed to pipeline": "PROCEED",
  Decline: "DECLINE",
  "Need more information": "NEED_MORE_INFO",
};

/** True when the team's eligibility decision differs from what the AI recommended (a learning moment). */
export function eligibilityDisagrees(aiRecommendation: string | null | undefined, decision: keyof typeof ELIGIBILITY_DECISION_TARGET): boolean {
  const ai = aiRecommendation ? AI_RECOMMENDATION_AS_DECISION[aiRecommendation] : undefined;
  return !!ai && ai !== decision;
}

/** How each human eligibility decision reads (deal page and exports). */
export const ELIGIBILITY_DECISION_LABELS = {
  PROCEED: "Proceed to pipeline",
  DECLINE: "Decline",
  NEED_MORE_INFO: "Request more information",
} as const;

/** Where each decision moves the deal. "Need more info" doesn't move it. */
export const ELIGIBILITY_DECISION_TARGET = {
  PROCEED: "PARTNER_REVIEW",
  DECLINE: "PASSED",
  NEED_MORE_INFO: null,
} as const satisfies Record<string, Stage | null>;

// ── Rounds ──────────────────────────────────────────────────────────────────

/** How many rounds the Round dropdown offers: at least 12, and always two beyond the highest in use. */
export function roundOptionCount(highestRoundInUse: number | null | undefined): number {
  return Math.max(12, (highestRoundInUse ?? 0) + 2);
}

export type RoundFilter = { kind: "all" } | { kind: "none" } | { kind: "round"; round: number };

/** Reads the board's ?round= filter: a round number, "none" (unassigned), or anything else = all. */
export function parseRoundFilter(value: string | string[] | undefined): RoundFilter {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "none") return { kind: "none" };
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? { kind: "round", round: n } : { kind: "all" };
}

/** The board's ?declined= toggle: "1" shows declined deals instead of the live pipeline. */
export function parseDeclinedFilter(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

/** Board URL for a round filter + declined toggle (both combine: a round's declined deals). */
export function boardHref(filter: RoundFilter, declined: boolean): string {
  const q = new URLSearchParams();
  if (filter.kind === "round") q.set("round", String(filter.round));
  if (filter.kind === "none") q.set("round", "none");
  if (declined) q.set("declined", "1");
  const qs = q.toString();
  return qs ? `/deals?${qs}` : "/deals";
}

/** In the declined view, which board column a deal sits in: the stage it was declined at
 *  (null when not recorded, or declined at a retired stage). */
export function declinedColumn(passedFromStage: Stage | null): Stage | null {
  if (!passedFromStage) return null;
  const col = boardColumn(passedFromStage);
  return BOARD_STAGES.some((s) => s.key === col) ? col : null;
}

// ── Dashboard metrics ───────────────────────────────────────────────────────

/** Invested: reached Investment Complete (S/EIS Certificate is after it). */
export function isInvestedStage(stage: Stage): boolean {
  return stage === "INVESTMENT_COMPLETE" || stage === "SEIS_CERTIFICATE";
}

export type DashboardMetrics = { liveDeals: number; inDueDiligence: number; investments: number; investedTotalGbp: number };

// ── Final investment ────────────────────────────────────────────────────────

type FinalLike = { ticketGbp: number; paidAt: Date | null };

/** Totals for the Final Investment section (live entries only). */
export function finalInvestmentTotals(entries: FinalLike[]) {
  const paid = entries.filter((e) => e.paidAt);
  return {
    committedGbp: sum(entries.map((e) => e.ticketGbp)),
    paidGbp: sum(paid.map((e) => e.ticketGbp)),
    angels: entries.length,
    paidCount: paid.length,
  };
}

/**
 * What DXV invested in a deal: the paid Final Investment tickets. Deals from before
 * Final Investment existed have no entries, so their typed-in amount counts instead.
 */
export function investedGbp(v: { investedAmountGbp: number | null; finalInvestments: FinalLike[] }): number {
  return v.finalInvestments.length > 0 ? finalInvestmentTotals(v.finalInvestments).paidGbp : (v.investedAmountGbp ?? 0);
}

/**
 * Live deals: not declined and not yet invested. Investments: deals at Investment
 * Complete (or S/EIS). Investment total: their paid final investment tickets.
 */
export function dashboardMetrics(
  ventures: { currentStage: Stage; investedAmountGbp: number | null; finalInvestments: FinalLike[] }[],
): DashboardMetrics {
  const invested = ventures.filter((v) => isInvestedStage(v.currentStage));
  return {
    liveDeals: ventures.filter((v) => isActiveStage(v.currentStage)).length,
    inDueDiligence: ventures.filter((v) => v.currentStage === "DUE_DILIGENCE").length,
    investments: invested.length,
    investedTotalGbp: sum(invested.map(investedGbp)),
  };
}

// ── Board presentation rules ────────────────────────────────────────────────

/** Broad phases the board colours columns by (brand tints, not extra colours). */
export type StagePhase = "intake" | "review" | "closing" | "invested" | "passed";

export function stagePhase(stage: Stage): StagePhase {
  if (stage === "PASSED") return "passed";
  if (isInvestedStage(stage)) return "invested";
  if (stageMeta(stage).intake) return "intake";
  if (stage === "INVESTMENT_COMMITMENTS" || stage === "DUE_DILIGENCE") return "closing";
  return "review";
}

/** Short money for cards and tiles: £950, £400k, £1.8m, £1.25m. */
export function formatGbpCompact(n: number): string {
  if (n < 1000) return `£${n}`;
  if (n < 1_000_000) return `£${+(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `£${+(n / 1_000_000).toFixed(2)}m`;
}

/** The card's one-liner: the AI screen's summary if there is one, else the description's first sentence. */
export function cardOneLiner(aiSummary: string | null | undefined, description: string | null | undefined): string | null {
  if (aiSummary?.trim()) return aiSummary.trim();
  const d = description?.trim();
  if (!d) return null;
  const first = d.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? d;
  return first.length > 120 ? `${first.slice(0, 117).trimEnd()}…` : first;
}

// ── AI investment assessment ────────────────────────────────────────────────

/** The AI assessment runs from DXV Partner Review onwards (after the eligibility screen); not for passed deals. */
export function canGenerateAssessment(stage: Stage): boolean {
  return stageIndex(stage) >= stageIndex("PARTNER_REVIEW");
}

// ── DD document ─────────────────────────────────────────────────────────────

/** The AI-assisted DD document follows the same rule as the assessment: Partner Review onwards, not passed. */
export function canCreateDDDocument(stage: Stage): boolean {
  return canGenerateAssessment(stage);
}

// ── Deal page layout ────────────────────────────────────────────────────────

/** The one-click "Advance" target: the next linear stage. Null when there's nowhere
 *  to go, or when the move needs its own decision form (the eligibility decision). */
export function advanceTarget(stage: Stage): Stage | null {
  if (stage === "ADD_TO_PIPELINE") return "PARTNER_REVIEW"; // retired stages
  if (stage === "CAPITAL_TRANSFER") return "INVESTMENT_COMPLETE";
  if (stage === "PASSED" || stage === "ELIGIBILITY_SCREEN") return null;
  const i = stageIndex(stage);
  return i >= 0 && i < LINEAR_STAGES.length - 1 ? LINEAR_STAGES[i + 1].key : null;
}

export type DealSection = "eligibility" | "assessment" | "preSelection" | "commitments" | "dd" | "final" | "documents";

/** Sections that matter at a stage: shown open and marked "Now"; the rest start collapsed. */
export function focusSections(stage: Stage): DealSection[] {
  switch (stage) {
    case "SUBMITTED":
    case "ELIGIBILITY_SCREEN":
      return ["eligibility", "documents"];
    case "ADD_TO_PIPELINE":
    case "PARTNER_REVIEW":
      return ["assessment", "documents"];
    case "PITCH_SELECTION":
      return ["assessment", "preSelection", "documents"];
    case "PITCH_OUTCOME":
      return ["preSelection", "commitments", "documents"];
    case "INVESTMENT_COMMITMENTS":
      return ["commitments", "dd", "documents"];
    case "DUE_DILIGENCE":
    case "CAPITAL_TRANSFER":
      return ["dd", "final", "documents"];
    case "INVESTMENT_COMPLETE":
    case "SEIS_CERTIFICATE":
      return ["final", "documents"];
    case "PASSED":
      return ["documents"];
  }
}

// ── Company stage ───────────────────────────────────────────────────────────

/** The company stage options (Blue's list); anything else is entered under "Other". */
export const COMPANY_STAGES = ["Pre-Seed", "Seed", "Series A", "Bridge Round"] as const;

/** Map free text (a deck, an old record) onto the options: "pre seed" is "Pre-Seed". Unknown text is kept as is. */
export function normaliseCompanyStage(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const k = t.toLowerCase().replace(/[\s_-]+/g, "");
  if (k === "preseed") return "Pre-Seed";
  if (k === "seed") return "Seed";
  if (k === "seriesa") return "Series A";
  if (k.includes("bridge")) return "Bridge Round";
  return t;
}

// ── Lead angel ──────────────────────────────────────────────────────────────

/** The usual DXV lead angels (anyone else is entered as free text under "Other"). */
export const LEAD_ANGELS = ["Blué", "Anna C", "Kevin W"] as const;

/** A board card's deck pill: "reading" while the board-intake read runs, "not-screened" once a deck is stored at Submitted without an eligibility screen. */
export type DeckCardState = "reading" | "not-screened" | null;

export function deckCardState(
  stage: Stage,
  latest: { status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED"; intakeOnly: boolean } | undefined,
  screened: boolean,
): DeckCardState {
  if (!latest) return null;
  const running = latest.status === "PENDING" || latest.status === "PROCESSING";
  if (running) return latest.intakeOnly ? "reading" : null; // a screen in progress needs no pill
  return !screened && stage === "SUBMITTED" ? "not-screened" : null;
}

// ── Angels (spec §8, §10) ───────────────────────────────────────────────────

export const ANGEL_STATUS_LABELS: Record<AngelStatus, string> = { PROSPECT: "Prospect", MEMBER: "Member", LAPSED: "Lapsed" };

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  HIGH_NET_WORTH: "High net worth",
  SELF_CERTIFIED_SOPHISTICATED: "Self-certified sophisticated",
  CERTIFIED_SOPHISTICATED: "Certified sophisticated (FCA firm)",
};

/**
 * How long each FCA investor statement lets DXV send an angel financial promotions
 * (COBS 4.12): HNW and self-certified sophisticated statements must be signed in the
 * last 12 months; a certified sophisticated investor certificate lasts 36 months.
 * To be confirmed by Kevin.
 */
export const CERTIFICATION_VALID_MONTHS: Record<CertificationType, number> = {
  HIGH_NET_WORTH: 12,
  SELF_CERTIFIED_SOPHISTICATED: 12,
  CERTIFIED_SOPHISTICATED: 36,
};

/** "Due soon" warning window before a statement expires. */
export const CERT_DUE_SOON_DAYS = 30;

export function certificationExpiry(type: CertificationType, signedOn: Date): Date {
  const d = new Date(signedOn);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + CERTIFICATION_VALID_MONTHS[type]);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay)); // 29 Feb + 12 months = 28 Feb
  return d;
}

export type CertLike = { signedOn: Date; expiresOn: Date };

/** The statement that counts: the most recently signed. */
export function latestCertification<T extends CertLike>(certs: T[]): T | null {
  return certs.reduce<T | null>((best, c) => (!best || c.signedOn > best.signedOn ? c : best), null);
}

export type CertState = "current" | "due-soon" | "overdue" | "none";

export function certState(latest: CertLike | null | undefined, now: Date = new Date()): CertState {
  if (!latest) return "none";
  const msLeft = latest.expiresOn.getTime() - now.getTime();
  if (msLeft <= 0) return "overdue";
  return msLeft <= CERT_DUE_SOON_DAYS * 86_400_000 ? "due-soon" : "current";
}

export const CERT_STATE_LABELS: Record<CertState, string> = { current: "Current", "due-soon": "Due soon", overdue: "Overdue", none: "Not certified" };

/** Members must hold a current statement; for them "none" is overdue too (the headline compliance number). */
export function certNeedsAction(status: AngelStatus, state: CertState): boolean {
  return status === "MEMBER" && (state === "overdue" || state === "none");
}

/**
 * The compliance gate (spec §10): who may see live deal terms and vote, once angels log
 * in. Enforce it on the server wherever angel-facing deal data is served.
 */
export function canSeeLiveDeals(angel: { status: AngelStatus; archivedAt: Date | null }, latest: CertLike | null, now: Date = new Date()): boolean {
  if (angel.status !== "MEMBER" || angel.archivedAt) return false;
  const s = certState(latest, now);
  return s === "current" || s === "due-soon";
}

/** Tags the team can pick from (free text allowed). Only record what the angel has shared. */
export const ANGEL_TAG_SUGGESTIONS = ["Woman angel", "First-time angel", "Founder", "Operator", "Lead angel experience"] as const;

/** A comma-separated list as typed: trimmed, blanks dropped, duplicates (any case) removed. */
export function parseList(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? "").split(/[,;\n]/)) {
    const t = part.trim().replace(/\s+/g, " ");
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

export type AngelFilter = "all" | "members" | "prospects" | "action" | "due-soon" | "lapsed";

export function parseAngelFilter(value: string | string[] | undefined): AngelFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "members" || v === "prospects" || v === "action" || v === "due-soon" || v === "lapsed" ? v : "all";
}

export function matchesAngelFilter(filter: AngelFilter, status: AngelStatus, state: CertState): boolean {
  switch (filter) {
    case "members":
      return status === "MEMBER";
    case "prospects":
      return status === "PROSPECT";
    case "action":
      return certNeedsAction(status, state);
    case "due-soon":
      return status === "MEMBER" && state === "due-soon";
    case "lapsed":
      return status === "LAPSED";
    default:
      return true;
  }
}

/**
 * Suggest which angel a name typed on a vote means: the exact name, else a unique
 * "First L" / first-name-only match (e.g. "Kevin W" = Kevin Walker). Null when unsure.
 */
export function suggestAngelMatch(typed: string, angels: { id: string; name: string }[]): string | null {
  const t = normaliseAngelName(typed).replace(/\./g, "");
  if (!t) return null;
  const exact = angels.filter((a) => normaliseAngelName(a.name) === t);
  if (exact.length === 1) return exact[0].id;
  const [first, second] = t.split(" ");
  const candidates = angels.filter((a) => {
    const [f, ...rest] = normaliseAngelName(a.name).split(" ");
    const last = rest.at(-1) ?? "";
    if (f !== first) return false;
    if (!second) return true;
    return second.length <= 2 ? last.startsWith(second[0]) : last === second;
  });
  return candidates.length === 1 ? candidates[0].id : null;
}

/** Groups of possible duplicate angels: same email, or same name. */
export function findDuplicateAngels<T extends { id: string; name: string; email: string | null }>(angels: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const a of angels) {
    for (const key of [a.email ? `e:${a.email.trim().toLowerCase()}` : null, `n:${normaliseAngelName(a.name)}`]) {
      if (key) groups.set(key, [...(groups.get(key) ?? []), a]);
    }
  }
  const seen = new Set<string>();
  const out: T[][] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sig = g.map((a) => a.id).sort().join(",");
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(g);
    }
  }
  return out;
}

/** Which angel a vote or investment belongs to: picked from the list, else a confirmed alias of the typed name. */
export function resolveAngelId(row: { angelId: string | null; angelName: string }, aliases: Map<string, string>): string | null {
  return row.angelId ?? aliases.get(normaliseAngelName(row.angelName)) ?? null;
}

/**
 * An angel's totals: committed = their latest EOI per deal (if interested), summed;
 * invested = paid final investment tickets. Removed entries are excluded by the caller.
 */
export function angelTotals(
  eois: { ventureId: string; interested: boolean; maxTicketGbp: number; createdAt: Date }[],
  finals: { ticketGbp: number; paidAt: Date | null }[],
): { committedGbp: number; investedGbp: number; deals: number } {
  const latest = new Map<string, (typeof eois)[number]>();
  for (const e of eois) {
    const cur = latest.get(e.ventureId);
    if (!cur || e.createdAt >= cur.createdAt) latest.set(e.ventureId, e);
  }
  const committed = [...latest.values()].filter((e) => e.interested);
  return {
    committedGbp: committed.reduce((a, e) => a + e.maxTicketGbp, 0),
    investedGbp: finals.filter((f) => f.paidAt).reduce((a, f) => a + f.ticketGbp, 0),
    deals: committed.length,
  };
}

// ── Angel portal onboarding ─────────────────────────────────────────────────

/** Onboarding answers (what the angel tells us about themselves). */
export const TICKET_RANGES = ["Under £1k", "£1k to £2k", "£2k to £5k", "£5k to £10k", "£10k to £25k", "£25k+"] as const;
export const EXPERIENCE_LEVELS = ["I haven't made an angel investment yet", "1 to 5 angel investments", "6 or more angel investments", "I invest professionally"] as const;
export const SECTOR_SUGGESTIONS = ["Fintech", "Healthtech", "Climate", "Edtech", "Consumer", "B2B SaaS", "Deeptech", "Impact", "Creative industries", "Food"] as const;

export type OnboardingStep = "profile" | "certify" | "welcome" | "done";

/**
 * The next onboarding step for an angel who has signed in (terms were accepted when they
 * set their password): confirm or fill in their profile, then certify (or say no exemption
 * applies), then the welcome. Certify is done when their statement is current.
 */
export function nextOnboardingStep(
  a: { profileConfirmedAt: Date | null; restrictedDeclaredAt: Date | null; onboardedAt: Date | null },
  latest: CertLike | null,
  now: Date = new Date(),
): OnboardingStep {
  if (!a.profileConfirmedAt) return "profile";
  const s = certState(latest, now);
  if (s !== "current" && s !== "due-soon" && !a.restrictedDeclaredAt) return "certify";
  return a.onboardedAt ? "done" : "welcome";
}

/** Where an angel's portal access stands, for the admin view. */
export type PortalState = "not-invited" | "invited" | "invite-expired" | "onboarding" | "active" | "revoked";

export function portalState(
  a: { onboardedAt: Date | null },
  user: { disabledAt: Date | null } | null,
  latestInvite: { expiresAt: Date; usedAt: Date | null; revokedAt: Date | null; kind: "INVITE" | "RESET" } | null,
  now: Date = new Date(),
): PortalState {
  if (user?.disabledAt) return "revoked";
  if (user) return a.onboardedAt ? "active" : "onboarding";
  if (!latestInvite || latestInvite.kind !== "INVITE" || latestInvite.revokedAt) return "not-invited";
  return latestInvite.expiresAt > now ? "invited" : "invite-expired";
}

export const PORTAL_STATE_LABELS: Record<PortalState, string> = {
  "not-invited": "Not invited",
  invited: "Invited (link not used yet)",
  "invite-expired": "Invite expired",
  onboarding: "Signed up, onboarding",
  active: "Active on the portal",
  revoked: "Access revoked",
};

/** Minimum password length for angel logins. */
export const MIN_PASSWORD_LENGTH = 10;

// ── Deal room (what angels see of a deal; Blue, 2026-10-04) ────────────────

/**
 * Deal-room phases: members see the pitch deck from Member Pitch Selection; the deck,
 * memo and supporting documents from the post-pitch vote (Pitch Outcome); all
 * applicable documents from Investment Commitments on. Earlier stages and declined
 * deals: nothing, even if shared.
 */
export type AngelDealPhase = "pitch-selection" | "post-pitch" | "commitments";

export function angelDealPhase(stage: Stage): AngelDealPhase | null {
  switch (stage) {
    case "PITCH_SELECTION":
      return "pitch-selection";
    case "PITCH_OUTCOME":
      return "post-pitch";
    case "INVESTMENT_COMMITMENTS":
    case "DUE_DILIGENCE":
    case "INVESTMENT_COMPLETE":
    case "SEIS_CERTIFICATE":
      return "commitments";
    default:
      return null;
  }
}

export const ANGEL_PHASE_LABELS: Record<AngelDealPhase, string> = {
  "pitch-selection": "Pitch selection",
  "post-pitch": "After the pitch",
  commitments: "Investment",
};

/** The phase an angel sees a deal in, or null if they can't see it at all (not shared, too early, declined). */
export function angelDealVisibility(v: { sharedWithAngelsAt: Date | null; currentStage: Stage }): AngelDealPhase | null {
  return v.sharedWithAngelsAt ? angelDealPhase(v.currentStage) : null;
}

const PHASE_ORDER: AngelDealPhase[] = ["pitch-selection", "post-pitch", "commitments"];
const atLeast = (phase: AngelDealPhase, min: AngelDealPhase) => PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(min);

/** The locked memo (DXV Review Issue) is shown from the post-pitch vote. */
export const angelSeesMemo = (phase: AngelDealPhase) => atLeast(phase, "post-pitch");

/**
 * Whether a (non-deck) document is shown in this phase: only if the team chose a phase
 * for it and that phase has been reached. Archived or unfinished uploads never.
 */
export function angelSeesDocument(
  phase: AngelDealPhase,
  doc: { angelVisibleFrom: AngelDocVisibility | null; archivedAt: Date | null; uploadedAt: Date | null },
  dd: { open: boolean; committed: boolean } = { open: false, committed: false },
): boolean {
  if (doc.archivedAt || !doc.uploadedAt || !doc.angelVisibleFrom) return false;
  // Due-diligence documents: only once DD has started, and only for members who committed.
  if (doc.angelVisibleFrom === "DUE_DILIGENCE") return dd.open && dd.committed;
  return atLeast(phase, doc.angelVisibleFrom === "POST_PITCH" ? "post-pitch" : "commitments");
}

export type AngelDocVisibility = "POST_PITCH" | "COMMITMENTS" | "DUE_DILIGENCE";

/** Due-diligence documents open to committed members from Due Diligence on (and stay open after investing). */
export function angelDdOpen(stage: Stage): boolean {
  return stage === "DUE_DILIGENCE" || stage === "INVESTMENT_COMPLETE" || stage === "SEIS_CERTIFICATE";
}

/**
 * The angels who committed to a deal: their latest (live) EOI says interested, or they
 * have a (live) Final Investment ticket. Entries link to angels by angelId or a confirmed
 * alias; unlinked typed names count for nobody. Callers pass only live (not removed) rows.
 */
export function committedAngelIds(
  eois: { angelId: string | null; angelName: string; interested: boolean; createdAt: Date }[],
  finals: { angelId: string | null; angelName: string }[],
  aliases: Map<string, string>,
): Set<string> {
  const latest = new Map<string, { interested: boolean; createdAt: Date }>();
  for (const e of eois) {
    const id = resolveAngelId(e, aliases);
    if (!id) continue;
    const cur = latest.get(id);
    if (!cur || e.createdAt >= cur.createdAt) latest.set(id, e);
  }
  const ids = new Set([...latest].filter(([, e]) => e.interested).map(([id]) => id));
  for (const f of finals) {
    const id = resolveAngelId(f, aliases);
    if (id) ids.add(id);
  }
  return ids;
}

/** What an angel can record at this stage: interest in hearing the pitch, then their EOI. */
export function angelVoteKind(stage: Stage): "pre-selection" | "eoi" | null {
  if (stage === "PITCH_SELECTION") return "pre-selection";
  if (stage === "PITCH_OUTCOME" || stage === "INVESTMENT_COMMITMENTS") return "eoi";
  return null;
}

export const ANGEL_DOC_PHASE_LABELS: Record<AngelDocVisibility, string> = {
  POST_PITCH: "From the post-pitch vote",
  COMMITMENTS: "From Investment Commitments",
  DUE_DILIGENCE: "From Due Diligence: committed members only",
};

// ── Team logins (DXV partners) ──────────────────────────────────────────────

/**
 * Why a team member's access can't be switched off right now, or null if it can.
 * Everyone on the team has the same rights; the only guards stop the team locking
 * itself out: nobody revokes their own login, and the last active login stays.
 */
export function teamRevokeBlock(actorId: string, targetId: string, activeTeamLogins: number): string | null {
  if (actorId === targetId) return "You can't revoke your own access.";
  if (activeTeamLogins <= 1) return "This is the last active team login.";
  return null;
}
