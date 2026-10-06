// Founder submissions from the public /apply page: the form's rules, spam limits, duplicate
// matching and which founder email fits a decision. Pure; unit-tested; shared by the form
// (browser) and the server.

import { z } from "zod";
import type { Gate, Stage } from "@/generated/prisma/enums";
import { normaliseCompanyName } from "./deal-import";
import { FOUNDER_DIVERSITY_THEMES } from "./pipeline";

export const COMPANY_STAGES = ["Pre-seed", "Seed"] as const;

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  text(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();
const url = (label: string) =>
  optional(300).refine((s) => !s || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s), `${label} should be a full web address, starting https://`);

export const SubmissionSchema = z
  .object({
    companyName: text(120).min(1, "Add your company's name"),
    founderNames: text(200).min(1, "Add the founders' names"),
    email: z.string().trim().toLowerCase().pipe(z.email("Add an email address we can reply to")),
    pitch: text(200).min(10, "Describe what the company does in one line"),
    sector: text(80).min(1, "Add your sector"),
    companyStage: z.enum(COMPANY_STAGES, { message: "Choose your stage" }),
    raiseAmountGbp: z.coerce
      .number({ message: "Add how much you're raising (in £)" })
      .int("Use whole pounds")
      .min(1, "Add how much you're raising (in £)")
      .max(100_000_000, "That raise looks too big: check the number"),
    website: url("Website"),
    linkedinUrl: url("LinkedIn"),
    heardFrom: optional(120),
    diversityThemes: z.array(z.string().trim().max(60)).max(14).default([]),
    // "Other": the founder's own words, kept as one more theme.
    diversityOther: z.string().trim().max(60, "Keep your \"Other\" answer to 60 characters").optional(),
    privacyConsent: z.literal(true, { message: "Please agree to how we'll use your details" }),
    diversityConsent: z.boolean().default(false),
    fileName: text(255).refine((n) => /\.pdf$/i.test(n), "Upload your deck as a PDF"),
    fileSize: z.number().int().positive().max(20 * 1024 * 1024, "Decks must be 20 MB or smaller"),
  })
  .transform(({ diversityOther, ...d }) => ({
    ...d,
    // Diversity answers are only kept with explicit consent (special-category data).
    diversityThemes: d.diversityConsent
      ? [...new Set([...d.diversityThemes, diversityOther ?? ""].filter((t) => t && t !== "Prefer not to say" && t !== "Other"))]
      : [],
  }));
export type SubmissionInput = z.input<typeof SubmissionSchema>;

export const DIVERSITY_OPTIONS = [...FOUNDER_DIVERSITY_THEMES, "Prefer not to say"];

/** Spam limits: per person (by hashed IP), per email address, and overall per day. */
export const SUBMISSION_LIMITS = { perIpPerHour: 5, perEmailPerDay: 3, perDay: 60 } as const;

export function submissionLimitError(n: { fromIpLastHour: number; fromEmailLastDay: number; totalLastDay: number }): string | null {
  if (n.totalLastDay >= SUBMISSION_LIMITS.perDay || n.fromIpLastHour >= SUBMISSION_LIMITS.perIpPerHour) {
    return "We've had a lot of submissions just now. Please try again later, or email your deck to angels@diversityx.vc.";
  }
  if (n.fromEmailLastDay >= SUBMISSION_LIMITS.perEmailPerDay) return "We've already received several submissions from this email today. We'll be in touch.";
  return null;
}

/** People take at least a few seconds to fill the form; bots are instant. Old pages are refreshed. */
export function formTimingOk(issuedAtMs: number, nowMs: number): boolean {
  const age = nowMs - issuedAtMs;
  return age >= 3_000 && age <= 12 * 3_600_000;
}

/** "Jane Doe & John Smith" → "Jane". */
export function founderFirstName(founderNames: string | null | undefined): string {
  const first = (founderNames ?? "").split(/,|&|\band\b|\//i)[0]?.trim().split(/\s+/)[0];
  return first || "there";
}

export type VentureMatch = { mode: "new" } | { mode: "resubmission"; ventureId: string } | { mode: "previously-declined"; ventureId: string };

/**
 * The same company already on the board gets the new deck added (no duplicate deal); a
 * company DXV declined before starts a fresh deal, linked back to the old one.
 */
export function matchExistingVenture(companyName: string, ventures: { id: string; name: string; currentStage: Stage; createdAt: Date }[]): VentureMatch {
  const key = normaliseCompanyName(companyName);
  if (!key) return { mode: "new" };
  const same = ventures.filter((v) => normaliseCompanyName(v.name) === key).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const live = same.find((v) => v.currentStage !== "PASSED");
  if (live) return { mode: "resubmission", ventureId: live.id };
  if (same[0]) return { mode: "previously-declined", ventureId: same[0].id };
  return { mode: "new" };
}

/** Which founder email template answers a decision: a decline, or a move forward. */
export const founderTemplateKey = (gate: Gate) => (gate === "PASSED" ? "founder-decline" : "founder-progress");
