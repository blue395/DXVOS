// No secret, service key or admin credential can reach the browser (docs/privacy security
// checklist). Client components ("use client") may only read NEXT_PUBLIC_ settings, and
// the public settings must never be a secret.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "generated" ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("no secrets in browser code", () => {
  it("client components read only NEXT_PUBLIC_ settings", () => {
    const offenders = files("src")
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/process\.env(?:\.|\[["'])([A-Z0-9_]+)/g)].map((m) => m[1]).filter((k) => !k.startsWith("NEXT_PUBLIC_")).map((k) => `${f}: ${k}`));
    expect(offenders).toEqual([]);
  });

  it("no NEXT_PUBLIC_ setting is named like a secret", () => {
    const names = new Set(files("src").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0])));
    expect([...names].filter((n) => /SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN/.test(n))).toEqual([]);
  });

  it("the server-only secret helpers can't be imported by client components", () => {
    for (const f of ["src/lib/session.ts", "src/lib/db.ts", "src/lib/diversity/store.ts", "src/lib/team-signin.ts", "src/lib/mail.ts"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/^import "server-only";/m);
    }
  });
});
