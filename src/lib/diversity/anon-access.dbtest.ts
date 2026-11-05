// Security audit (Blue, 2026-11-05): a Supabase-style anonymous role can't call the
// diversity functions the team uses (they're SECURITY DEFINER, so a missing REVOKE would
// hand out the counts or one member's answers). Synthetic database only.
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

afterAll(() => db.$disconnect());

describe("diversity functions and an anonymous caller", () => {
  it.each(["SELECT * FROM dxv_diversity_counts()", "SELECT * FROM dxv_diversity_for_angel('x', 'x', 'audit')"])("refuses %s", async (sql) => {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_anon') THEN CREATE ROLE audit_anon NOLOGIN NOBYPASSRLS; END IF; END $$`,
    );
    await db.$executeRawUnsafe(`GRANT audit_anon TO CURRENT_USER`);
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE audit_anon`);
        await tx.$queryRawUnsafe(sql);
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
