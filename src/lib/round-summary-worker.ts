// Runs one Partner Review round summary: claim the job, then for each deal read its deck
// and ask Claude (a few at a time), then assemble the working copy. Same pattern as
// memo-worker.ts (plain SQL; shared with the Netlify function). One deal failing never
// sinks the rest: it's marked in the document and the partners can write it themselves.
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { apiErrorMessage, workerAnthropic } from "./ai-client";
import { sslOptions } from "./db-ssl";
import { readDeck } from "./deck-storage";
import { summariseDeal } from "./round-summary/analyze";
import { buildSummaryContent } from "./round-summary/build";
import type { RoundSummaryContext } from "./round-summary/context";
import { fakeSummaryClient } from "./round-summary/mock";
import { RoundSummaryError, type RoundSummaryAiOutput, type RoundSummaryContent } from "./round-summary/schema";

/** Worker tokens for round summaries carry this prefix (so they can't start another kind of job). */
export const ROUND_SUMMARY_JOB_PREFIX = "round-summary:";

/** Deals summarised at once (keeps within Anthropic's rate limits; a round is usually up to 6 deals). */
const CONCURRENCY = 3;

export type RoundSummaryWorkerDeps = { pool?: Pool; anthropic?: Anthropic; readDeck?: (storagePath: string) => Promise<Buffer> };

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeSummaryClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new RoundSummaryError("ANTHROPIC_API_KEY isn't set, so summaries can't be written yet.");
  return workerAnthropic();
}

const errorMessage = (e: unknown) =>
  e instanceof RoundSummaryError ? e.message : e instanceof Anthropic.APIError ? apiErrorMessage(e) : e instanceof Error ? e.message : "Unknown error";

async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function runRoundSummary(summaryId: string, deps: RoundSummaryWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });

  try {
    const claimed = await pool.query<{ context: RoundSummaryContext; round: number; number: number }>(
      `UPDATE "RoundSummary" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' RETURNING context, round, number`,
      [summaryId],
    );
    const job = claimed.rows[0];
    if (!job) return;

    try {
      const client = deps.anthropic ?? defaultAnthropic();
      const read = deps.readDeck ?? readDeck;
      let model: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      const results = await inBatches(job.context.deals, CONCURRENCY, async (deal) => {
        try {
          const pdf = deal.deck ? await read(deal.deck.storagePath) : null;
          const r = await summariseDeal(client, job.context, deal, pdf);
          model = r.model;
          inputTokens += r.inputTokens;
          outputTokens += r.outputTokens;
          return { ventureId: deal.ventureId, summary: r.summary, error: null };
        } catch (e) {
          console.error(`Round summary ${summaryId}: ${deal.name} failed:`, e);
          return { ventureId: deal.ventureId, summary: null, error: errorMessage(e).slice(0, 300) };
        }
      });
      const ai: RoundSummaryAiOutput = { deals: results };
      if (results.length && results.every((r) => !r.summary)) throw new RoundSummaryError(results[0].error ?? "No deal could be summarised.");

      // The partners' notes from the round's previous summary carry over (matched by deal).
      const prev = await pool.query<{ content: RoundSummaryContent }>(
        `SELECT content FROM "RoundSummary" WHERE round = $1 AND number < $2 AND status = 'COMPLETE' AND content IS NOT NULL ORDER BY number DESC LIMIT 1`,
        [job.round, job.number],
      );
      const content = buildSummaryContent(job.context, ai, prev.rows[0]?.content ?? null);
      await pool.query(
        `UPDATE "RoundSummary" SET status = 'COMPLETE', model = $2, "aiOutput" = $3::jsonb, content = $4::jsonb,
           "inputTokens" = $5, "outputTokens" = $6, "completedAt" = now()
         WHERE id = $1`,
        [summaryId, model, JSON.stringify(ai), JSON.stringify(content), inputTokens, outputTokens],
      );
    } catch (e) {
      console.error(`Round summary ${summaryId} failed:`, e);
      await pool.query(`UPDATE "RoundSummary" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`, [
        summaryId,
        errorMessage(e).slice(0, 500),
      ]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
