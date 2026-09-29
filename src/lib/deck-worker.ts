// Runs one deck analysis end to end: claim the job, read the deck from storage,
// ask Claude, save the result (or the error). Called by the Netlify background
// function in production, and in-process during local development.
//
// Uses plain SQL via `pg` rather than Prisma, so the Netlify function bundle stays
// small and simple. Shared with the worker: no Next-only imports.
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { analyzeDeck, DeckAnalysisError } from "./deck-ai/analyze";
import type { AiContextSnapshot, EligibilityPlaybook } from "./playbook/schema";
import { fakeAnthropicClient } from "./deck-ai/mock";
import { sslOptions } from "./db-ssl";
import { readDeck } from "./deck-storage";

export type WorkerDeps = {
  pool?: Pool;
  anthropic?: Anthropic;
  readDeck?: (storagePath: string) => Promise<Buffer>;
};

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeAnthropicClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new DeckAnalysisError("ANTHROPIC_API_KEY isn't set, so decks can't be read yet.");
  return new Anthropic();
}

export async function runDeckAnalysis(analysisId: string, deps: WorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });

  try {
    // Claim atomically: only a PENDING job can start, so a double trigger can't
    // run (and bill) the same deck twice.
    const claimed = await pool.query<{ storagePath: string; fileName: string; aiContext: AiContextSnapshot<EligibilityPlaybook> | null }>(
      `UPDATE "DeckAnalysis" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING'
       RETURNING "storagePath", "fileName", "aiContext"`,
      [analysisId],
    );
    const job = claimed.rows[0];
    if (!job) return; // already running, finished, or unknown

    try {
      const pdf = await (deps.readDeck ?? readDeck)(job.storagePath);
      const result = await analyzeDeck(deps.anthropic ?? defaultAnthropic(), pdf, job.fileName, job.aiContext);
      await pool.query(
        `UPDATE "DeckAnalysis"
         SET status = 'COMPLETE', model = $2, extracted = $3::jsonb, screen = $4::jsonb,
             "inputTokens" = $5, "outputTokens" = $6, "completedAt" = now()
         WHERE id = $1`,
        [
          analysisId,
          result.model,
          JSON.stringify(result.output.extracted),
          JSON.stringify(result.output.screen),
          result.inputTokens,
          result.outputTokens,
        ],
      );
    } catch (e) {
      const message =
        e instanceof DeckAnalysisError
          ? e.message
          : e instanceof Anthropic.APIError
            ? `Claude API error (${e.status ?? "network"}). Try again in a minute.`
            : e instanceof Error
              ? e.message
              : "Unknown error";
      console.error(`Deck analysis ${analysisId} failed:`, e);
      await pool.query(
        `UPDATE "DeckAnalysis" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`,
        [analysisId, message.slice(0, 500)],
      );
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
