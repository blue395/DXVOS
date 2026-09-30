"use server";

// DXV's syndicate portfolio: the team's details on invested deals, and syndicate
// investments added by hand. Every action checks requireAdmin() first; who added or
// last edited each entry is recorded. Removing one archives it.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { INSTRUMENT_LABELS, isInvestedStage, parseMoneyMinor, PORTFOLIO_CURRENCIES } from "@/lib/pipeline";
import { founderDiversityFrom } from "@/components/founder-diversity-field";
import type { ActionResult } from "@/lib/action-result";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => s || null);

const money = (label: string) =>
  z
    .string()
    .optional()
    .transform((s, ctx) => {
      const n = parseMoneyMinor(s);
      if (Number.isNaN(n)) ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 25,000 or 991.83` });
      return n;
    });

const whole = (label: string) =>
  z
    .string()
    .optional()
    .transform((s, ctx) => {
      const t = (s ?? "").replace(/[,\s]/g, "");
      if (!t) return null;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0) ctx.addIssue({ code: "custom", message: `${label}: enter a whole number` });
      return n;
    });

const date = z
  .string()
  .optional()
  .transform((s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null));

const DetailsSchema = z.object({
  description: text(600),
  instrument: z.enum([...(Object.keys(INSTRUMENT_LABELS) as [keyof typeof INSTRUMENT_LABELS]), ""]).optional().transform((s) => s || null),
  valuation: money("Valuation"),
  sharePrice: z
    .string()
    .optional()
    .transform((s, ctx) => {
      const t = (s ?? "").replace(/[£$€,\s]/g, "");
      if (!t) return null;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) ctx.addIssue({ code: "custom", message: "Share price: enter a number like 2.40" });
      return n;
    }),
  currentValue: money("Current value"),
  currentValueOn: date,
  status: z.enum(["ACTIVE", "EXITED", "WRITTEN_OFF"]).default("ACTIVE"),
  proceeds: money("Proceeds"),
  taxScheme: z.enum(["SEIS", "EIS", "NONE", ""]).optional().transform((s) => s || null),
  notes: text(6000),
});

const AddedSchema = DetailsSchema.extend({
  companyName: z.string().trim().min(1, "Enter the company name").max(200),
  sector: text(120),
  round: whole("DXV round"),
  companyStage: text(60),
  investedOn: date,
  currency: z.enum(PORTFOLIO_CURRENCIES).default("GBP"),
  amount: money("Amount invested"),
  angelsCount: whole("Number of angels"),
});

type Details = z.infer<typeof DetailsSchema>;
const detailsData = (d: Details) => ({
  description: d.description,
  instrument: d.instrument,
  valuationAtInvestment: d.valuation === null ? null : Math.round(d.valuation / 100),
  sharePrice: d.sharePrice,
  currentValueMinor: d.currentValue,
  currentValueOn: d.currentValueOn,
  status: d.status,
  proceedsMinor: d.status === "EXITED" ? d.proceeds : null,
  taxScheme: d.taxScheme,
  notes: d.notes,
});

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form.";

function revalidatePortfolio() {
  revalidatePath("/portfolio");
}

/** Add or update a syndicate investment not tracked as a deal. */
export async function saveSyndicateHolding(holdingId: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = AddedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.amount === null) return { error: "Enter the amount the syndicate invested." };
  const data = {
    ...detailsData(d),
    // Hand-added investments have no deal, so their founder diversity lives here.
    diversityThemes: founderDiversityFrom(formData),
    companyName: d.companyName,
    sector: d.sector,
    round: d.round,
    companyStage: d.companyStage,
    investedOn: d.investedOn,
    currency: d.currency,
    amountMinor: d.amount,
    angelsCount: d.angelsCount,
    updatedById: user.id,
  };
  if (holdingId) {
    const { count } = await db.syndicateHolding.updateMany({ where: { id: holdingId, ventureId: null, archivedAt: null }, data });
    if (count !== 1) return { error: "That investment no longer exists." };
  } else {
    await db.syndicateHolding.create({ data: { ...data, createdById: user.id } });
  }
  revalidatePortfolio();
  redirect("/portfolio");
}

/** The team's details on a deal DXV invested in. */
export async function saveSyndicateDealDetails(ventureId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = DetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = await db.venture.findUnique({ where: { id: ventureId }, select: { currentStage: true } });
  if (!v || !isInvestedStage(v.currentStage)) return { error: "That deal isn't in the portfolio (it isn't at Investment Complete)." };
  const data = { ...detailsData(parsed.data), updatedById: user.id, archivedAt: null };
  await db.syndicateHolding.upsert({
    where: { ventureId },
    create: { ...data, ventureId, createdById: user.id },
    update: data,
  });
  revalidatePortfolio();
  redirect("/portfolio");
}

/** Remove a hand-added syndicate investment (kept, archived). */
export async function archiveSyndicateHolding(holdingId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const { count } = await db.syndicateHolding.updateMany({
    where: { id: holdingId, ventureId: null, archivedAt: null },
    data: { archivedAt: new Date(), updatedById: user.id },
  });
  if (count !== 1) return { error: "That investment no longer exists." };
  revalidatePortfolio();
  redirect("/portfolio");
}
