"use server";

// My Portfolio: the signed-in angel's own investment records. Every action calls
// requireAngel() and only touches that angel's records (ids from the session; a DXV
// ticket must be theirs). Removing an investment archives it.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAngel } from "@/lib/auth";
import { db } from "@/lib/db";
import { INSTRUMENT_LABELS, parseMoneyMinor, PORTFOLIO_CURRENCIES } from "@/lib/pipeline";
import { ownsFinalInvestment } from "@/lib/portfolio";
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
      if (Number.isNaN(n)) ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 1,000 or 991.83` });
      return n;
    });

const date = z
  .string()
  .optional()
  .transform((s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null));

const DetailsSchema = z.object({
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
  shares: z
    .string()
    .optional()
    .transform((s, ctx) => {
      const t = (s ?? "").replace(/[,\s]/g, "");
      if (!t) return null;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0) ctx.addIssue({ code: "custom", message: "Number of shares: enter a whole number" });
      return n;
    }),
  currentValue: money("Current value"),
  currentValueOn: date,
  status: z.enum(["ACTIVE", "EXITED", "WRITTEN_OFF"]).default("ACTIVE"),
  proceeds: money("Proceeds"),
  taxScheme: z.enum(["SEIS", "EIS", "NONE", ""]).optional().transform((s) => s || null),
  taxCertificateReceived: z.string().optional().transform((s) => s === "on"),
  shareCertificateReceived: z.string().optional().transform((s) => s === "on"),
  notes: text(6000),
});

const OutsideSchema = DetailsSchema.extend({
  companyName: z.string().trim().min(1, "Enter the company name").max(200),
  description: text(600),
  sector: text(120),
  investedVia: text(120),
  round: text(60),
  investedOn: date,
  currency: z.enum(PORTFOLIO_CURRENCIES).default("GBP"),
  amount: money("Amount invested"),
});

type Details = z.infer<typeof DetailsSchema>;
const detailsData = (d: Details) => ({
  instrument: d.instrument,
  valuationAtInvestment: d.valuation === null ? null : Math.round(d.valuation / 100),
  sharePrice: d.sharePrice,
  shares: d.shares,
  currentValueMinor: d.currentValue,
  currentValueOn: d.currentValueOn,
  status: d.status,
  proceedsMinor: d.status === "EXITED" ? d.proceeds : null,
  taxScheme: d.taxScheme,
  taxCertificateReceived: d.taxCertificateReceived,
  shareCertificateReceived: d.shareCertificateReceived,
  // One notes box now: earlier "how I heard" and "why I invested" answers were shown in it, so they live there.
  source: null,
  rationale: null,
  notes: d.notes,
});

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form.";

/** Add or update an investment made outside DXV. */
export async function saveOutsideHolding(holdingId: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { angel } = await requireAngel();
  const parsed = OutsideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.amount === null) return { error: "Enter the amount you invested." };
  const data = {
    ...detailsData(d),
    companyName: d.companyName,
    description: d.description,
    sector: d.sector,
    investedVia: d.investedVia,
    round: d.round,
    investedOn: d.investedOn,
    currency: d.currency,
    amountMinor: d.amount,
  };
  if (holdingId) {
    const { count } = await db.portfolioHolding.updateMany({ where: { id: holdingId, angelId: angel.id, finalInvestmentId: null, archivedAt: null }, data });
    if (count !== 1) return { error: "That investment no longer exists." };
  } else {
    await db.portfolioHolding.create({ data: { ...data, angelId: angel.id } });
  }
  revalidatePath("/portal/portfolio");
  redirect("/portal/portfolio");
}

/** The angel's own details on one of their DXV syndicate investments. */
export async function saveDxvDetails(finalInvestmentId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { angel } = await requireAngel();
  const parsed = DetailsSchema.extend({ description: text(600) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await ownsFinalInvestment(angel.id, finalInvestmentId))) return { error: "That investment isn't on your record." };
  const data = { ...detailsData(parsed.data), description: parsed.data.description };
  await db.portfolioHolding.upsert({
    where: { finalInvestmentId },
    create: { ...data, angelId: angel.id, finalInvestmentId },
    update: data,
  });
  revalidatePath("/portal/portfolio");
  redirect("/portal/portfolio");
}

/** Remove an outside investment from the portfolio (kept, archived). */
export async function archiveHolding(holdingId: string): Promise<ActionResult> {
  const { angel } = await requireAngel();
  const { count } = await db.portfolioHolding.updateMany({
    where: { id: holdingId, angelId: angel.id, finalInvestmentId: null, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count !== 1) return { error: "That investment no longer exists." };
  revalidatePath("/portal/portfolio");
  redirect("/portal/portfolio");
}
