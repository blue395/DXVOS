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
  /** Stages 1–2 are intake; formal pipeline tracking starts at "Add to pipeline". */
  intake?: boolean;
};

// Ordered. The index in this array IS the pipeline order.
export const LINEAR_STAGES: StageMeta[] = [
  { key: "FOUNDER_DECK", label: "Founder deck", intake: true },
  {
    key: "ELIGIBILITY_SCREENING",
    label: "Eligibility screening",
    intake: true,
    gate: "ELIGIBILITY",
    proceedDecision: "Proceed",
  },
  { key: "ADD_TO_PIPELINE", label: "Add to pipeline" },
  { key: "INTERNAL_REVIEW", label: "DXV internal team review" },
  {
    key: "PITCH_SELECTION",
    label: "Pitch selection",
    gate: "PITCH_SELECTION",
    proceedDecision: "Invited to pitch",
  },
  {
    key: "PITCH_OUTCOME",
    label: "Pitch outcome",
    gate: "PITCH_OUTCOME",
    proceedDecision: "Proceeding to EOI",
  },
  {
    key: "INVESTMENT_VOTES",
    label: "Investment votes",
    gate: "INVESTMENT_VOTES",
    proceedDecision: "Threshold met — proceeding to DD",
  },
  {
    key: "DUE_DILIGENCE",
    label: "Due Diligence",
    gate: "DUE_DILIGENCE",
    proceedDecision: "Proceeding to investment",
  },
  { key: "CAPITAL_TRANSFER", label: "Capital Transfer" },
  { key: "INVESTMENT", label: "Investment" },
];

export const PASSED_STAGE: StageMeta = { key: "PASSED", label: "Passed", gate: "PASSED" };

export const ALL_STAGES: StageMeta[] = [...LINEAR_STAGES, PASSED_STAGE];

export function stageMeta(stage: Stage): StageMeta {
  const meta = ALL_STAGES.find((s) => s.key === stage);
  if (!meta) throw new Error(`Unknown stage ${stage}`);
  return meta;
}

export function stageLabel(stage: Stage): string {
  return stageMeta(stage).label;
}

/** Position in the linear pipeline; PASSED has no position (-1). */
export function stageIndex(stage: Stage): number {
  return LINEAR_STAGES.findIndex((s) => s.key === stage);
}

// ── Gates ───────────────────────────────────────────────────────────────────

export const GATE_LABELS: Record<Gate, string> = {
  ELIGIBILITY: "After Eligibility screening",
  PITCH_SELECTION: "After Pitch selection",
  PITCH_OUTCOME: "After Pitch outcome",
  INVESTMENT_VOTES: "After Investment votes",
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
  if (from === null || from === "PASSED") return [];

  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(to);
  if (toIdx <= fromIdx) return [];

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

// ── Investment votes / momentum ─────────────────────────────────────────────

/** Spec §5: "currently £20k in one week". Change here if the syndicate changes the rule. */
export const MOMENTUM_THRESHOLD_GBP = 20_000;
export const EOI_WINDOW_DAYS = 7;

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

export type EoiSummary = {
  interestedCount: number;
  totalGbp: number;
  /** Total from votes cast inside the EOI window — what the threshold is judged on. */
  withinWindowGbp: number;
  windowStart: Date | null;
  windowEnd: Date | null;
  windowOpen: boolean;
  thresholdMet: boolean;
};

/**
 * @param windowStart when the deal entered Investment votes (null if it hasn't yet)
 */
export function eoiSummary(votes: EoiLike[], windowStart: Date | null, now: Date = new Date()): EoiSummary {
  const latest = latestVotePerAngel(votes).filter((v) => v.interested);
  const totalGbp = sum(latest.map((v) => v.maxTicketGbp));

  const windowEnd = windowStart ? new Date(windowStart.getTime() + EOI_WINDOW_DAYS * DAY_MS) : null;

  // For the threshold, use each angel's latest vote *as of the window closing*.
  const inWindow = windowStart
    ? latestVotePerAngel(votes.filter((v) => v.createdAt >= windowStart && v.createdAt <= windowEnd!)).filter(
        (v) => v.interested,
      )
    : [];
  const withinWindowGbp = sum(inWindow.map((v) => v.maxTicketGbp));

  return {
    interestedCount: latest.length,
    totalGbp,
    withinWindowGbp,
    windowStart,
    windowEnd,
    windowOpen: !!windowEnd && now <= windowEnd,
    thresholdMet: withinWindowGbp >= MOMENTUM_THRESHOLD_GBP,
  };
}

// ── Card warnings (spec §13 — the two drafted conditions) ───────────────────

export type WarningInput = {
  currentStage: Stage;
  stageEnteredAt: Date;
  ddItems: { dueDate: Date | null; completedAt: Date | null }[];
};

export function dealWarnings(v: WarningInput, now: Date = new Date()): string[] {
  const warnings: string[] = [];
  if (v.currentStage === "INVESTMENT_VOTES" && now.getTime() - v.stageEnteredAt.getTime() > EOI_WINDOW_DAYS * DAY_MS) {
    warnings.push("Stalled past the EOI window");
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
  return stage === "FOUNDER_DECK" || stage === "ELIGIBILITY_SCREENING";
}

/** Where each decision moves the deal. "Need more info" doesn't move it. */
export const ELIGIBILITY_DECISION_TARGET = {
  PROCEED: "ADD_TO_PIPELINE",
  DECLINE: "PASSED",
  NEED_MORE_INFO: null,
} as const satisfies Record<string, Stage | null>;
