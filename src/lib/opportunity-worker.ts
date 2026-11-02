// Drafts a members' opportunities pack: claim the job, then for each company read its deck
// and ask Claude (a few at a time), then assemble the working copy. Same pattern as
// round-summary-worker.ts (plain SQL; shared with the Netlify function). A company the AI
// couldn't draft is marked, never dropped: the partners can write its slide themselves.
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { apiErrorMessage, workerAnthropic } from "./ai-client";
import { sslOptions } from "./db-ssl";
import { readDeck } from "./deck-storage";
import { draftOpportunity } from "./opportunities/analyze";
import { buildOpportunityContent } from "./opportunities/build";
import type { OpportunityContext } from "./opportunities/context";
import { fakeOpportunityClient } from "./opportunities/mock";
import { OpportunityError, type OpportunityAiOutput } from "./opportunities/schema";

/** Worker tokens for opportunities packs carry this prefix (so they can't start another kind of job). */
export const OPPORTUNITY_JOB_PREFIX = "opportunities:";

const CONCURRENCY = 3;

export type OpportunityWorkerDeps = { pool?: Pool; anthropic?: Anthropic; readDeck?: (storagePath: string) => Promise<Buffer> };

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeOpportunityClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new OpportunityError("ANTHROPIC_API_KEY isn't set, so packs can't be drafted yet.");
  return workerAnthropic();
}

const errorMessage = (e: unknown) =>
  e instanceof OpportunityError ? e.message : e instanceof Anthropic.APIError ? apiErrorMessage(e) : e instanceof Error ? e.message : "Unknown error";

export async function runOpportunityPack(packId: string, deps: OpportunityWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });
  try {
    const claimed = await pool.query<{ context: OpportunityContext; title: string }>(
      `UPDATE "OpportunityPack" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' RETURNING context, title`,
      [packId],
    );
    const job = claimed.rows[0];
    if (!job) return;
    try {
      const client = deps.anthropic ?? defaultAnthropic();
      const read = deps.readDeck ?? readDeck;
      let model: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      const deals = job.context.deals;
      const results: OpportunityAiOutput["deals"] = new Array(deals.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, deals.length) }, async () => {
          while (next < deals.length) {
            const i = next++;
            const deal = deals[i];
            try {
              const pdf = deal.deck ? await read(deal.deck.storagePath) : null;
              const r = await draftOpportunity(client, job.context, deal, pdf);
              model = r.model;
              inputTokens += r.inputTokens;
              outputTokens += r.outputTokens;
              results[i] = { ventureId: deal.ventureId, draft: r.draft, error: null };
            } catch (e) {
              console.error(`Opportunities pack ${packId}: ${deal.name} failed:`, e);
              results[i] = { ventureId: deal.ventureId, draft: null, error: errorMessage(e).slice(0, 300) };
            }
          }
        }),
      );
      if (results.length && results.every((r) => !r.draft)) throw new OpportunityError(results[0].error ?? "No company could be drafted.");
      const ai: OpportunityAiOutput = { deals: results };
      const content = buildOpportunityContent(job.context, ai, job.title);
      await pool.query(
        `UPDATE "OpportunityPack" SET status = 'COMPLETE', model = $2, "aiOutput" = $3::jsonb, content = $4::jsonb,
           "inputTokens" = $5, "outputTokens" = $6, "completedAt" = now() WHERE id = $1`,
        [packId, model, JSON.stringify(ai), JSON.stringify(content), inputTokens, outputTokens],
      );
    } catch (e) {
      console.error(`Opportunities pack ${packId} failed:`, e);
      await pool.query(`UPDATE "OpportunityPack" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`, [
        packId,
        errorMessage(e).slice(0, 500),
      ]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
