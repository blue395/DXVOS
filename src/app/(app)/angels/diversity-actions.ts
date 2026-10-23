"use server";

// A partner viewing one member's diversity answers (Blue, 2026-10-23: partners keep this,
// for named DXV team members only, "only when needed": the privacy notice). Every view
// needs a reason and is logged by the database itself (who, when, why: DiversityAccessLog).
// The answers go straight back to the partner's screen: never cached, logged or put in a URL.
import { requireAdmin } from "@/lib/auth";
import { viewMemberDiversity, DiversityError } from "@/lib/diversity/store";
import { CATEGORY_LABELS, questionFor } from "@/lib/diversity/questions";

export type PeekResult = { error?: string; rows?: { category: string; question: string; value: string; consentGivenAt: string }[] };

export async function viewAngelDiversity(angelId: string, reason: string): Promise<PeekResult> {
  const user = await requireAdmin();
  const why = reason.trim();
  if (why.length < 5) return { error: "Say why you need to see this (it's logged)." };
  try {
    const rows = await viewMemberDiversity(angelId, user.id, why);
    return {
      rows: rows.map((r) => ({
        category: CATEGORY_LABELS[r.category],
        question: questionFor(r.question)?.label || questionFor(r.question)?.hint || r.question,
        value: r.selfDescribed ? `${r.value} (in their own words)` : r.value,
        consentGivenAt: r.consentGivenAt.toISOString(),
      })),
    };
  } catch (e) {
    if (e instanceof DiversityError) return { error: "Couldn't load this just now." };
    throw e;
  }
}
