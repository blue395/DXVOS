// Pipeline domain rules — pure functions, no database or UI.
// Everything the board, the deal page and the dashboard need to agree on lives here,
// so there's exactly one definition of "what's a gate", "what counts towards momentum", etc.

import type { Gate, PassReason, Stage } from "@/generated/prisma/enums";

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
// Revised 2026-09-28: decision gates at stages 2 to 7.
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
  { key: "CAPITAL_TRANSFER", label: "Capital Transfer" },
  { key: "INVESTMENT_COMPLETE", label: "Investment Complete" },
  { key: "SEIS_CERTIFICATE", label: "S/EIS Certificate", optional: true },
];

export const PASSED_STAGE: StageMeta = { key: "PASSED", label: "Passed", gate: "PASSED" };

/** Every stage a deal can be in today (what the board and stage pickers offer). */
export const ALL_STAGES: StageMeta[] = [...LINEAR_STAGES, PASSED_STAGE];

/** Stages no longer used, kept so old stage history still reads correctly. */
const RETIRED_STAGES: StageMeta[] = [{ key: "ADD_TO_PIPELINE", label: "Add to pipeline (retired)" }];

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
  PASSED: "Passed",
};

export type OwedComm = { gate: Gate; decision: string };

/**
 * Which founder comms become owed when a deal moves from `from` to `to`.
 *
 * - Moving to PASSED: always owed a response (one "Decline" message).
 * - Moving forward: every gate stage we leave behind is owed its "proceed" message.
 *   (Usually one; more if an admin skips stages.)
 * - Moving backwards, or re-opening from PASSED: nothing new is owed.
 */
export function gatesCrossed(from: Stage | null, to: Stage, passReason?: PassReason | null): OwedComm[] {
  if (to === "PASSED") {
    const why = passReason ? ` — ${PASS_REASON_LABELS[passReason]}` : "";
    return [{ gate: "PASSED", decision: `Decline${why}` }];
  }
  if (from === null) return [];

  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(to);
  if (fromIdx < 0 || toIdx <= fromIdx) return []; // from Passed / a retired stage, or backwards

  return LINEAR_STAGES.slice(fromIdx, toIdx)
    .filter((s) => s.gate)
    .map((s) => ({ gate: s.gate!, decision: s.proceedDecision! }));
}

// ── Passing ─────────────────────────────────────────────────────────────────

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

/** Running total: each angel's latest vote counts; only "interested" votes add to the total. */
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

// ── Dashboard metrics ───────────────────────────────────────────────────────

/** Invested: reached Investment Complete (S/EIS Certificate is after it). */
export function isInvestedStage(stage: Stage): boolean {
  return stage === "INVESTMENT_COMPLETE" || stage === "SEIS_CERTIFICATE";
}

export type DashboardMetrics = { liveDeals: number; inDueDiligence: number; investments: number; investedTotalGbp: number };

/**
 * Live deals: not passed and not yet invested. Investment total: sum of what DXV
 * actually invested (entered per deal); deals without an amount count as £0.
 */
export function dashboardMetrics(ventures: { currentStage: Stage; investedAmountGbp: number | null }[]): DashboardMetrics {
  const invested = ventures.filter((v) => isInvestedStage(v.currentStage));
  return {
    liveDeals: ventures.filter((v) => isActiveStage(v.currentStage)).length,
    inDueDiligence: ventures.filter((v) => v.currentStage === "DUE_DILIGENCE").length,
    investments: invested.length,
    investedTotalGbp: sum(invested.map((v) => v.investedAmountGbp ?? 0)),
  };
}

// ── Board presentation rules ────────────────────────────────────────────────

/** Broad phases the board colours columns by (brand tints, not extra colours). */
export type StagePhase = "intake" | "review" | "closing" | "invested" | "passed";

export function stagePhase(stage: Stage): StagePhase {
  if (stage === "PASSED") return "passed";
  if (isInvestedStage(stage)) return "invested";
  if (stageMeta(stage).intake) return "intake";
  if (stage === "INVESTMENT_COMMITMENTS" || stage === "DUE_DILIGENCE" || stage === "CAPITAL_TRANSFER") return "closing";
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
  if (stage === "ADD_TO_PIPELINE") return "PARTNER_REVIEW"; // retired stage
  if (stage === "PASSED" || stage === "ELIGIBILITY_SCREEN") return null;
  const i = stageIndex(stage);
  return i >= 0 && i < LINEAR_STAGES.length - 1 ? LINEAR_STAGES[i + 1].key : null;
}

export type DealSection = "eligibility" | "assessment" | "memo" | "preSelection" | "commitments" | "dd" | "documents";

/** Sections that matter at a stage: shown open and marked "Now"; the rest start collapsed. */
export function focusSections(stage: Stage): DealSection[] {
  switch (stage) {
    case "SUBMITTED":
    case "ELIGIBILITY_SCREEN":
      return ["eligibility", "documents"];
    case "ADD_TO_PIPELINE":
    case "PARTNER_REVIEW":
      return ["assessment", "memo", "documents"];
    case "PITCH_SELECTION":
      return ["memo", "preSelection", "documents"];
    case "PITCH_OUTCOME":
      return ["preSelection", "commitments", "documents"];
    case "INVESTMENT_COMMITMENTS":
      return ["commitments", "dd", "documents"];
    case "DUE_DILIGENCE":
    case "CAPITAL_TRANSFER":
      return ["dd", "commitments", "documents"];
    case "INVESTMENT_COMPLETE":
    case "SEIS_CERTIFICATE":
      return ["commitments", "documents"];
    case "PASSED":
      return ["documents"];
  }
}
