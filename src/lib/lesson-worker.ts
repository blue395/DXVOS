// Runs one lesson-suggestion job: claim it, ask Claude, save the suggestions as
// SUGGESTED lessons for the team to approve. Same pattern as memo-worker.ts
// (plain SQL; shared with the Netlify function).
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sslOptions } from "./db-ssl";
import { suggestLessons } from "./lessons-ai/analyze";
import type { LessonJobContext } from "./lessons-ai/context";
import { fakeLessonClient } from "./lessons-ai/mock";
import { LessonSuggestionError } from "./lessons-ai/schema";

/** Worker tokens for lesson jobs carry this prefix, so they can't start another kind of job. */
export const LESSON_JOB_PREFIX = "lesson:";

export type LessonWorkerDeps = { pool?: Pool; anthropic?: Anthropic };

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeLessonClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new LessonSuggestionError("ANTHROPIC_API_KEY isn't set.");
  return new Anthropic();
}

const TRIGGER_ORIGIN: Record<string, string> = {
  DECLINED: "Suggested when the deal was declined",
  MEMO_REVIEWED: "Suggested when the team changed the AI's memo scores",
  ELIGIBILITY_DECIDED: "Suggested when the eligibility decision differed from the AI",
};

export async function runLessonJob(jobId: string, deps: LessonWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });

  try {
    const claimed = await pool.query<{ ventureId: string; trigger: string; context: LessonJobContext }>(
      `UPDATE "LessonJob" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' RETURNING "ventureId", trigger, context`,
      [jobId],
    );
    const job = claimed.rows[0];
    if (!job) return;

    try {
      const result = await suggestLessons(deps.anthropic ?? defaultAnthropic(), job.context);
      const origin = `${TRIGGER_ORIGIN[job.trigger] ?? "Suggested by the AI"}: ${job.context.moment}`.slice(0, 300);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const l of result.lessons) {
          await client.query(
            `INSERT INTO "Lesson" (id, title, body, scope, status, source, origin, "ventureId", "jobId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'SUGGESTED', 'AI', $5, $6, $7, now(), now())`,
            [randomUUID(), l.title.slice(0, 140), l.body, l.scope, origin, job.ventureId, jobId],
          );
        }
        await client.query(
          `UPDATE "LessonJob" SET status = 'COMPLETE', model = $2, "inputTokens" = $3, "outputTokens" = $4, "completedAt" = now() WHERE id = $1`,
          [jobId, result.model, result.inputTokens, result.outputTokens],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`Lesson job ${jobId} failed:`, e);
      await pool.query(`UPDATE "LessonJob" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`, [jobId, message.slice(0, 500)]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
