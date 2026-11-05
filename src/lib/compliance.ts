import "server-only";
// The approved legal wording in use (see compliance-texts.ts for the starting drafts).
import type { ComplianceTextKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { privacyNoticeGaps } from "@/content/privacy-notice";

export const COMPLIANCE_KINDS: ComplianceTextKind[] = ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT", "MEMBER_TERMS"];

/** The approved version of each text (missing = not approved yet). */
export async function approvedTexts() {
  const rows = await db.complianceText.findMany({ where: { status: "APPROVED" } });
  return new Map(rows.map((r) => [r.kind, r]));
}

/**
 * Invites need all three texts approved (terms at sign-up, both statements to certify) and
 * the privacy notice's controller details filled in (src/content/privacy-notice.ts).
 */
export async function complianceReady(): Promise<{ ready: boolean; missing: ComplianceTextKind[]; privacyGaps: string[] }> {
  const approved = await approvedTexts();
  const missing = COMPLIANCE_KINDS.filter((k) => !approved.has(k));
  const privacyGaps = privacyNoticeGaps();
  return { ready: missing.length === 0 && privacyGaps.length === 0, missing, privacyGaps };
}

/** Why invites are paused, in plain words (null: they aren't). */
export function inviteBlockReason(r: { missing: ComplianceTextKind[]; privacyGaps: string[] }): string | null {
  const parts: string[] = [];
  if (r.missing.length) parts.push("approve the investor statements and member terms (Angels → Statements & terms)");
  if (r.privacyGaps.length) parts.push(`add ${r.privacyGaps.join(", ")} to the privacy notice (src/content/privacy-notice.ts)`);
  return parts.length ? `Before inviting anyone, ${parts.join(", and ")}.` : null;
}
