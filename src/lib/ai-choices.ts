// Fixed-choice fields in AI answers (Blue, 2026-11-06: Sonura's eligibility screen failed on
// a stage label). The Anthropic SDK can't send a JSON-schema "enum" to the API: it moves the
// allowed values into the field's description, so the API only enforces "a string" and Claude
// occasionally writes a near-miss ("Pre-Seed", "Pre-seed (pre-revenue)", "Series B"). One such
// label used to throw away the whole answer. Here we send the same strict schema (the choices
// are still listed for Claude) but read the answer forgivingly: near-misses map onto the right
// choice, anything else onto a safe fallback where there is one.
//
// Pure, relative imports only: shared with the Netlify workers.
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";
import { z } from "zod";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();

/**
 * The allowed choice an answer means, or null: the same ignoring case, spaces and punctuation;
 * a listed synonym; or an answer that starts with a choice ("Pre-seed (pre-revenue)"), the
 * longest choice first so "Pre-seed" isn't read as "Seed".
 */
export function matchChoice<T extends string>(raw: unknown, allowed: readonly T[], synonyms: Record<string, T> = {}): T | null {
  if (typeof raw !== "string") return null;
  const n = norm(raw);
  if (!n) return null;
  const exact = allowed.find((a) => norm(a) === n);
  if (exact) return exact;
  for (const [k, v] of Object.entries(synonyms)) if (norm(k) === n) return v;
  const byLength = [...allowed].sort((a, b) => norm(b).length - norm(a).length);
  const prefix = byLength.find((a) => n.startsWith(`${norm(a)} `));
  if (prefix) return prefix;
  for (const [k, v] of Object.entries(synonyms).sort((a, b) => b[0].length - a[0].length)) if (n.startsWith(`${norm(k)} `)) return v;
  return null;
}

/**
 * A fixed-choice field read forgivingly. With a `fallback`, anything unrecognised becomes the
 * fallback; without one, an unrecognised answer is still an error (e.g. a memo criterion name,
 * where guessing would put a score against the wrong criterion).
 */
export function lenientChoice<T extends string>(allowed: readonly [T, ...T[]], opts: { fallback?: T; synonyms?: Record<string, T> } = {}) {
  return z.unknown().transform((raw, ctx): T => {
    const m = matchChoice(raw, allowed, opts.synonyms);
    if (m) return m;
    if (opts.fallback) return opts.fallback;
    ctx.addIssue({ code: "custom", message: `expected one of ${allowed.map((a) => `"${a}"`).join(" | ")}` });
    return z.NEVER;
  });
}

/**
 * The output format for messages.parse(): Claude is sent `strict` (exactly as before), and the
 * answer is read with `lenient` (the same shape, with fixed choices read by lenientChoice()).
 */
export function lenientOutputFormat<L extends z.ZodType>(strict: z.ZodType, lenient: L): AutoParseableOutputFormat<z.infer<L>> {
  const base = zodOutputFormat(strict);
  return {
    ...base,
    parse: (content: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse structured output as JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      const out = lenient.safeParse(parsed);
      if (!out.success) {
        const issues = out.error.issues
          .slice(0, 5)
          .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Failed to parse structured output:\n${issues}`);
      }
      return out.data;
    },
  };
}
