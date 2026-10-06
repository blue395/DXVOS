// My Portfolio as a CSV, for the signed-in angel only (their own records).
import { getCurrentUser, hasMemberAccess } from "@/lib/auth";
import { HOLDING_STATUS_LABELS, INSTRUMENT_LABELS, holdingMultiple, holdingValueMinor } from "@/lib/pipeline";
import { loadPortfolio } from "@/lib/portfolio";
import { csvCell } from "@/lib/csv";

const money = (minor: number | null | undefined) => (minor == null ? "" : (minor / 100).toFixed(2));
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasMemberAccess(user) || !user.angelId) return new Response("Unauthorised", { status: 401 });
  const { rows } = await loadPortfolio(user.angelId);
  const header = [
    "Company", "What they do", "Via", "Sector", "Status", "Date invested", "Round", "Instrument", "Currency", "Amount invested",
    "Valuation at investment", "Share price", "Shares", "Value today", "Value as of", "Proceeds", "Multiple",
    "S/EIS", "S/EIS certificate received", "Share certificate received", "Founder diversity", "Notes",
  ];
  const lines = rows.map((r) =>
    [
      r.company, r.description, r.investedVia, r.sector, r.pending ? "Payment pending" : HOLDING_STATUS_LABELS[r.status], day(r.investedOn), r.round,
      r.instrument ? INSTRUMENT_LABELS[r.instrument] : "", r.currency, money(r.amountMinor), r.valuationAtInvestment, r.sharePrice, r.shares,
      money(holdingValueMinor(r)), day(r.currentValueOn), money(r.proceedsMinor), holdingMultiple(r)?.toFixed(2),
      r.taxScheme, r.taxCertificateReceived ? "Yes" : "No", r.shareCertificateReceived ? "Yes" : "No", r.diversityThemes.join("; "),
      [r.rationale, r.notes, r.heardVia ? `How I heard about it: ${r.heardVia}` : null].filter(Boolean).join("\n\n"),
    ].map(csvCell).join(","),
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="My DXV portfolio ${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
