// Fails if a log call could print diversity or consent data (docs/privacy: never log,
// send to error tracking or analytics, diversity answers or consent records). It scans every
// console.* call in the app's code and refuses any whose arguments (outside plain string
// text) mention a diversity / consent field. Fix the log line rather than this list.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SENSITIVE = /\b(diversit\w*|consent\w*|answers?|selfDescribed|subjectId|sexual\w*|ethnic\w*|religio\w*|gender\w*|disabilit\w*|neurodiver\w*|wordingVersion|pending|accessLog|reason)\b/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "generated" || f === "node_modules" ? [] : files(p);
    return /\.(ts|tsx|mts)$/.test(f) && !/\.(test|dbtest)\.ts$/.test(f) ? [p] : [];
  });
}

/** The argument text of each console.* call (balanced parentheses), with plain string text removed. */
export function logCallArguments(source: string): string[] {
  const out: string[] = [];
  const re = /console\.(log|info|warn|error|debug|trace)\s*\(/g;
  while (re.exec(source)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
    }
    const args = source.slice(re.lastIndex, i - 1);
    // Drop quoted text but keep ${...} expressions inside template strings.
    const code = args
      .replace(/`(?:[^`\\$]|\\.|\$(?!\{))*`/g, "``")
      .replace(/`[^`]*`/g, (t) => (t.match(/\$\{[^}]*\}/g) ?? []).join(" "))
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    out.push(code);
  }
  return out;
}

describe("no diversity or consent data in log calls", () => {
  it("the scanner catches a bad log line and allows a safe one", () => {
    expect(logCallArguments('console.error("[diversity] save failed", answers)').some((a) => SENSITIVE.test(a))).toBe(true);
    expect(logCallArguments("console.log(`saving ${consent.status}`)").some((a) => SENSITIVE.test(a))).toBe(true);
    expect(logCallArguments("console.error(`[diversity] ${what} failed (${code})`)").some((a) => SENSITIVE.test(a))).toBe(false);
  });

  it("no log call in the app mentions a diversity or consent field", () => {
    const offenders = [...files("src"), ...files("netlify"), ...files("scripts")].flatMap((f) =>
      logCallArguments(readFileSync(f, "utf8"))
        .filter((a) => SENSITIVE.test(a))
        .map((a) => `${f}: console(${a.trim().slice(0, 80)})`),
    );
    expect(offenders).toEqual([]);
  });
});
