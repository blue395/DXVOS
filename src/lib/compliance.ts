import "server-only";
// The approved legal wording in use (see compliance-texts.ts for the starting drafts).
import type { ComplianceTextKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const COMPLIANCE_KINDS: ComplianceTextKind[] = ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT", "MEMBER_TERMS"];

/** The approved version of each text (missing = not approved yet). */
export async function approvedTexts() {
  const rows = await db.complianceText.findMany({ where: { status: "APPROVED" } });
  return new Map(rows.map((r) => [r.kind, r]));
}

/** Invites need all three texts approved (terms at sign-up, both statements to certify). */
export async function complianceReady(): Promise<{ ready: boolean; missing: ComplianceTextKind[] }> {
  const approved = await approvedTexts();
  const missing = COMPLIANCE_KINDS.filter((k) => !approved.has(k));
  return { ready: missing.length === 0, missing };
}
