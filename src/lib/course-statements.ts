import "server-only";
import { db } from "./db";
import type { StatementCriteria } from "@/app/learn/(pages)/describe-options";

/** The approved investor statement criteria (the Deal Platform's versioned FCA wording), for "What this means". */
export async function approvedStatementCriteria(): Promise<StatementCriteria> {
  const texts = await db.complianceText.findMany({
    where: { kind: { in: ["HNW_STATEMENT", "SOPHISTICATED_STATEMENT"] }, status: "APPROVED" },
    orderBy: { version: "desc" },
    select: { kind: true, title: true, criteria: true },
  });
  const pick = (kind: string) => {
    const t = texts.find((x) => x.kind === kind);
    return t ? { title: t.title, criteria: t.criteria } : null;
  };
  return { HNW_STATEMENT: pick("HNW_STATEMENT"), SOPHISTICATED_STATEMENT: pick("SOPHISTICATED_STATEMENT") };
}
