// Edit history for EOIs and final investments: what an entry looked like, and one
// readable line per change. Pure (shared by the actions and the deal page).
import { formatGbp } from "./pipeline";

export type EntrySnapshot = {
  angelName: string;
  interested?: boolean; // EOIs
  maxTicketGbp?: number; // EOIs
  ticketGbp?: number; // final investments
  paid?: boolean; // final investments
  note: string | null;
};

type AuditLike = { action: "EDIT" | "REMOVE" | "PAID" | "UNPAID"; before: unknown; after: unknown };

const money = (n: number | undefined) => (n === undefined ? "" : formatGbp(n));

/** "Edited Jane Doe: ticket £10,000 to £15,000; note added" and similar. */
export function describeChange(a: AuditLike): string {
  const before = a.before as EntrySnapshot;
  const after = (a.after ?? null) as EntrySnapshot | null;
  if (a.action === "REMOVE") return `Removed ${before.angelName}${before.ticketGbp ?? before.maxTicketGbp ? ` (${money(before.ticketGbp ?? before.maxTicketGbp)})` : ""}`;
  if (a.action === "PAID") return `Marked ${before.angelName} as paid`;
  if (a.action === "UNPAID") return `Marked ${before.angelName} as not paid`;
  if (!after) return `Edited ${before.angelName}`;

  const changes: string[] = [];
  if (before.angelName !== after.angelName) changes.push(`name ${before.angelName} to ${after.angelName}`);
  if (before.interested !== after.interested && after.interested !== undefined)
    changes.push(after.interested ? "now interested" : "now not interested");
  if (before.maxTicketGbp !== after.maxTicketGbp && after.maxTicketGbp !== undefined)
    changes.push(`max ticket ${money(before.maxTicketGbp)} to ${money(after.maxTicketGbp)}`);
  if (before.ticketGbp !== after.ticketGbp && after.ticketGbp !== undefined)
    changes.push(`ticket ${money(before.ticketGbp)} to ${money(after.ticketGbp)}`);
  if ((before.note ?? "") !== (after.note ?? "")) changes.push(after.note ? (before.note ? "note changed" : "note added") : "note removed");
  return `Edited ${before.angelName}${changes.length ? `: ${changes.join("; ")}` : " (no changes)"}`;
}
