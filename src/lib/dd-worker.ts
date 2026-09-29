// Runs one DD document job: claim it, read the deck, ask Claude for a DD plan,
// build the branded Word file, store it under Documents → Due diligence.
// Same pattern as memo-worker.ts (plain SQL; shared with the Netlify function).
import Anthropic from "@anthropic-ai/sdk";
import { apiErrorMessage, workerAnthropic } from "./ai-client";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sslOptions } from "./db-ssl";
import { objectPath, readObject, uploadObject } from "./deck-storage";
import { analyzeDD } from "./dd-doc/analyze";
import { buildDDDocx, ddFileName } from "./dd-doc/build";
import type { DDContext } from "./dd-doc/context";
import { fakeDDClient } from "./dd-doc/mock";
import { DDPlanError } from "./dd-doc/schema";

/** Worker tokens for DD jobs carry this prefix, so they can't start a deck or memo job. */
export const DD_JOB_PREFIX = "dd:";

const DOCUMENTS_BUCKET = "documents"; // (documents.ts imports Prisma types; keep the worker free of them)
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DDWorkerDeps = {
  pool?: Pool;
  anthropic?: Anthropic;
  readObject?: (bucket: string, storagePath: string) => Promise<Buffer>;
  uploadObject?: (bucket: string, storagePath: string, bytes: Buffer, contentType: string) => Promise<void>;
};

function defaultAnthropic(): Anthropic {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeDDClient();
  if (!process.env.ANTHROPIC_API_KEY) throw new DDPlanError("ANTHROPIC_API_KEY isn't set, so DD documents can't be drafted yet.");
  return workerAnthropic();
}

export async function runDDReport(jobId: string, deps: DDWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 1 });

  try {
    const claimed = await pool.query<{ ventureId: string; context: DDContext; createdById: string }>(
      `UPDATE "DDReportJob" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' RETURNING "ventureId", context, "createdById"`,
      [jobId],
    );
    const job = claimed.rows[0];
    if (!job) return;

    try {
      const ctx = job.context;
      const pdf = ctx.deck ? await (deps.readObject ?? readObject)(ctx.deck.bucket, ctx.deck.storagePath) : null;
      const result = await analyzeDD(deps.anthropic ?? defaultAnthropic(), pdf, ctx);

      const generatedAt = new Date();
      const bytes = await buildDDDocx(ctx, result.plan, generatedAt);
      const documentId = randomUUID();
      const fileName = ddFileName(ctx.ventureName, generatedAt);
      const storagePath = objectPath(documentId, fileName, "docx");
      await (deps.uploadObject ?? uploadObject)(DOCUMENTS_BUCKET, storagePath, bytes, DOCX_MIME);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO "Document" (id, "ventureId", category, bucket, "storagePath", "fileName", "mimeType", "sizeBytes",
             note, "uploadedById", "uploadedAt")
           VALUES ($1, $2, 'DUE_DILIGENCE', $3, $4, $5, $6, $7, $8, $9, now())`,
          [documentId, job.ventureId, DOCUMENTS_BUCKET, storagePath, fileName, DOCX_MIME, bytes.length, "AI-assisted first draft (DXV OS)", job.createdById],
        );
        await client.query(
          `UPDATE "DDReportJob" SET status = 'COMPLETE', model = $2, output = $3::jsonb, "documentId" = $4,
             "inputTokens" = $5, "outputTokens" = $6, "completedAt" = now()
           WHERE id = $1`,
          [jobId, result.model, JSON.stringify(result.plan), documentId, result.inputTokens, result.outputTokens],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      const message =
        e instanceof DDPlanError
          ? e.message
          : e instanceof Anthropic.APIError
            ? apiErrorMessage(e)
            : e instanceof Error
              ? e.message
              : "Unknown error";
      console.error(`DD report ${jobId} failed:`, e);
      await pool.query(`UPDATE "DDReportJob" SET status = 'FAILED', error = $2, "completedAt" = now() WHERE id = $1`, [
        jobId,
        message.slice(0, 500),
      ]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
