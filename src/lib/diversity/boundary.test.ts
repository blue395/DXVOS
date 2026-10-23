// Only src/lib/diversity/ may touch the diversity tables, so every read and write goes
// through store.ts (one transaction, least-privilege role, no logging of values).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "generated" || f === "node_modules" ? [] : files(p);
    return /\.(ts|tsx|mts)$/.test(f) ? [p] : [];
  });
}

const TABLE_ACCESS =
  /\.diversity(Subject|Answer|Consent|ConsentLog|Pending|AccessLog)\.(find|create|update|upsert|delete|count|aggregate|groupBy)|"Diversity(Subject|Answer|Consent|ConsentLog|Pending|AccessLog)"|dxv_diversity_(counts|for_angel)/;

describe("diversity data boundary", () => {
  it("no code outside src/lib/diversity/ touches the diversity tables", () => {
    const offenders = [...files("src"), ...files("netlify"), ...files("scripts")]
      .filter((f) => !f.startsWith(path.join("src", "lib", "diversity")))
      .filter((f) => TABLE_ACCESS.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("DXV Brain's tools never mention diversity tables", () => {
    expect(readFileSync("src/lib/brain/tools.ts", "utf8")).not.toMatch(/diversity|consent/i);
  });
});
