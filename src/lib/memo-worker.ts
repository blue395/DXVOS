// Runs one AI memo assessment: claim the job, read the deck, ask Claude, save.
// Same pattern as deck-worker.ts (plain SQL; shared with the Netlify function).
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { sslOptions } from "./db-ssl";
import { readDeck } from "./deck-storage";
import { analyzeMemo } from "./memo-ai/analyze";
import type { MemoContext } from "./memo-ai/context";
import { fakeMemoClient } from "./memo-ai/mock";
import { MemoFormatError } from "./memo-ai/schema";

/** Worker tokens for memo jobs carry this prefix, so they can't start a deck job (or vice versa). */
export const MEMO_JOB_PREFIX = "memo:";

export type MemoWorkerDeps = { pool?: Pool; anthropic?: Anthropic; readDeck?: (storagePath: string) => Promise<Buffer> };

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeMemoClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new MemoFormatError("ANTHROPIC_API_KEY isn't set, so memos can't be drafted yet.");
  return new Anthropic();
}

export async function runMemoAnalysis(analysisId: string, deps: MemoWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });

  try {
    const claimed = await pool.query<{ context: MemoContext }>(
      `UPDATE "MemoAnalysis" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' RETURNING context`,
      [analysisId],
    );
    const job = claimed.rows[0];
    if (!job) return;

    try {
      if (!job.context.deck) throw new MemoFormatError("No deck is stored for this venture. Upload one first.");
      const pdf = await (deps.readDeck ?? readDeck)(job.context.deck.storagePath);
      const result = await analyzeMemo(deps.anthropic ?? defaultAnthropic(), pdf, job.context);
      await pool.query(
        `UPDATE "MemoAnalysis" SET status = 'COMPLETE', model = $2, output = $3::jsonb,
           "inputTokens" = $4, "outputTokens" = $5, "completedAt" = now()
         WHERE id = $1`,
        [analysisId, result.model, JSON.stringify(result.memo), result.inputTokens, result.outputTokens],
      );
    } catch (e) {
      const message =
        e instanceof MemoFormatError
          ? e.message
          : e instanceof Anthropic.APIError
            ? `Claude API error (${e.status ?? "network"}). Try again in a minute.`
            : e instanceof Error
              ? e.message
              : "Unknown error";
      console.error(`Memo analysis ${analysisId} failed:`, e);
      await pool.query(`UPDATE "MemoAnalysis" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`, [
        analysisId,
        message.slice(0, 500),
      ]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
