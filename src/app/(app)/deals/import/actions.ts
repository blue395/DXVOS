"use server";

// Historical deals import: older declined deals from a spreadsheet. The browser reads the
// file and maps the columns; this checks every row again and adds them in one go.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PassReason, Stage } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DECLINE_STAGES, normaliseCompanyName, resolveDecline, type DealImportRow } from "@/lib/deal-import";
import { importHistoricalDeclinedVentures } from "@/lib/ventures";

const text = (max: number) => z.string().trim().max(max).nullable().transform((s) => s || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const RowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  founderNames: text(300),
  founderEmail: text(200),
  website: text(500).refine((s) => !s || /^https?:\/\//.test(s)),
  sector: text(120),
  companyStage: text(60),
  raiseAmountGbp: z.number().int().min(0).max(1_000_000_000).nullable(),
  round: z.number().int().min(1).max(99).nullable(),
  leadAngel: text(120),
  description: text(5000),
  submittedOn: date,
  declinedOn: date,
  declinedAt: z.enum(DECLINE_STAGES as [Stage, ...Stage[]]).nullable(),
  reason: z.enum(PassReason).nullable(),
  reasonText: text(1000),
  note: text(5000),
});

/** Which of these company names DXV OS already has (compared ignoring case, punctuation and "Ltd"). */
export async function existingDealNames(): Promise<string[]> {
  await requireAdmin();
  const all = await db.venture.findMany({ select: { name: true } });
  return [...new Set(all.map((v) => normaliseCompanyName(v.name)))];
}

export type DealImportResult = { error: string } | { created: number; duplicates: string[]; invalid: number };

export async function importDeclinedDeals(rows: DealImportRow[], defaults: { stage: Stage; reason: PassReason }): Promise<DealImportResult> {
  const user = await requireAdmin();
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 500) return { error: "Import at most 500 deals at a time." };
  if (!DECLINE_STAGES.includes(defaults?.stage) || !Object.values(PassReason).includes(defaults?.reason)) return { error: "Choose the default stage and reason." };

  const existing = new Set((await db.venture.findMany({ select: { name: true } })).map((v) => normaliseCompanyName(v.name)));
  const duplicates: string[] = [];
  let invalid = 0;
  const deals = [];
  for (const raw of rows) {
    const parsed = RowSchema.safeParse(raw);
    if (!parsed.success) {
      invalid++;
      continue;
    }
    const row = parsed.data;
    const key = normaliseCompanyName(row.name);
    if (!key || existing.has(key)) {
      duplicates.push(row.name);
      continue;
    }
    existing.add(key); // the same company twice in one file
    deals.push({ ...row, ...resolveDecline(row, defaults) });
  }
  const created = deals.length ? await importHistoricalDeclinedVentures(deals, user.id) : 0;
  revalidatePath("/deals");
  revalidatePath("/");
  return { created, duplicates, invalid };
}
