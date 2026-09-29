// Angels as a CSV (admin only): contact details, status, certification and totals.
// Certification and financial data are sensitive: this is served only after the admin check.
import { getCurrentUser } from "@/lib/auth";
import { loadAngelRows } from "@/lib/angels";
import { ANGEL_STATUS_LABELS, CERT_STATE_LABELS, CERTIFICATION_LABELS } from "@/lib/pipeline";

const cell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  // Quote everything; neutralise spreadsheet formulas (CSV injection).
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorised", { status: 401 });
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  const rows = await loadAngelRows({ archived });
  const header = ["Name", "Email", "Phone", "Location", "Status", "Joined", "Sectors", "Tags", "WhatsApp groups", "Source", "Certification", "Statement type", "Signed", "Expires", "Committed (GBP)", "Invested (GBP)"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.phone,
      r.location,
      ANGEL_STATUS_LABELS[r.status],
      r.joinedAt,
      r.sectors.join(", "),
      r.tags.join(", "),
      r.whatsappGroups.join(", "),
      r.source,
      CERT_STATE_LABELS[r.certState],
      r.cert ? CERTIFICATION_LABELS[r.cert.type] : "",
      r.cert?.signedOn,
      r.cert?.expiresOn,
      r.committedGbp,
      r.investedGbp,
    ]
      .map(cell)
      .join(","),
  );
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dxv-angels-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
