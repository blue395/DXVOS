// Runs one DXV Brain reply: claim it, replay the chat, let Claude answer (with DXV OS
// lookups and web search), saving the text as it streams so the chat shows it arriving.
// Same pattern as the other AI workers (plain SQL; shared with the Netlify function).
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { fakeBrainCall } from "./brain/mock";
import { buildBrainSystem, type BrainContext } from "./brain/prompt";
import { BrainError, runBrainTurn, type BrainModelCall } from "./brain/run";
import { DECK_MARKER, runBrainTool } from "./brain/tools";
import { sslOptions } from "./db-ssl";
import { readDeck } from "./deck-storage";

/** Worker tokens for Brain replies carry this prefix, so they can't start another kind of job. */
export const BRAIN_JOB_PREFIX = "brain:";

type MessageParam = Anthropic.Beta.BetaMessageParam;

export type BrainWorkerDeps = { pool?: Pool; call?: BrainModelCall; readDeck?: (storagePath: string) => Promise<Buffer> };

/** How often the live text is saved while Claude writes (the chat polls about once a second). */
const SAVE_EVERY_MS = 500;

function defaultCall(): BrainModelCall {
  if (process.env.DECK_AI_MOCK === "true" && process.env.NODE_ENV !== "production") return fakeBrainCall();
  if (!process.env.ANTHROPIC_API_KEY) throw new BrainError("ANTHROPIC_API_KEY isn't set, so the Brain can't answer yet.");
  const client = new Anthropic();
  return async (params, on) => {
    const stream = client.beta.messages.stream(params);
    stream.on("text", on.onText);
    stream.on("streamEvent", (e) => {
      if (e.type === "content_block_start" && (e.content_block.type === "tool_use" || e.content_block.type === "server_tool_use")) {
        on.onBlock(e.content_block.name);
      }
    });
    return stream.finalMessage();
  };
}

// ── Decks in stored chats ───────────────────────────────────────────────────
// A deck the Brain read is sent to Claude as a PDF, but the chat stores only where it
// lives; replaying the chat reads the same (never overwritten) file back.

type AnyBlock = Record<string, unknown>;

function mapDocuments(turns: MessageParam[], fn: (doc: AnyBlock) => Promise<AnyBlock> | AnyBlock): Promise<MessageParam[]> {
  return Promise.all(
    turns.map(async (t) => {
      if (t.role !== "user" || !Array.isArray(t.content)) return t;
      const content = await Promise.all(
        t.content.map(async (b) => {
          if (b.type !== "tool_result" || !Array.isArray(b.content)) return b;
          const inner = await Promise.all((b.content as unknown as AnyBlock[]).map(async (c) => (c.type === "document" && String(c.context ?? "").startsWith(`${DECK_MARKER}:`) ? fn(c) : c)));
          return { ...b, content: inner };
        }),
      );
      return { ...t, content } as MessageParam;
    }),
  );
}

export const dehydrateDecks = (turns: MessageParam[]) => mapDocuments(turns, (doc) => ({ ...doc, source: { type: DECK_MARKER } }));

export const rehydrateDecks = (turns: MessageParam[], read: (storagePath: string) => Promise<Buffer>) =>
  mapDocuments(turns, async (doc) => ({
    ...doc,
    source: { type: "base64", media_type: "application/pdf", data: (await read(String(doc.context).slice(DECK_MARKER.length + 1))).toString("base64") },
  }));

// ── The job ─────────────────────────────────────────────────────────────────

export async function runBrainReply(messageId: string, deps: BrainWorkerDeps = {}): Promise<void> {
  const ownPool = !deps.pool;
  const connectionString = process.env.DATABASE_URL;
  const pool = deps.pool ?? new Pool({ connectionString, ssl: sslOptions(connectionString, process.env.DATABASE_CA_CERT), max: 2 });
  const read = deps.readDeck ?? readDeck;

  try {
    const claimed = await pool.query<{ conversationId: string; createdAt: Date }>(
      `UPDATE "BrainMessage" SET status = 'PROCESSING', "startedAt" = now(), error = NULL
       WHERE id = $1 AND status = 'PENDING' AND role = 'ASSISTANT' RETURNING "conversationId", "createdAt"`,
      [messageId],
    );
    const job = claimed.rows[0];
    if (!job) return; // already running, finished, or unknown

    // Saves are chained so they land in order; the final save waits for the chain.
    let saving: Promise<unknown> = Promise.resolve();
    let lastSave = 0;
    const save = (text: string, activity: string | null, force = false) => {
      const now = Date.now();
      if (!force && now - lastSave < SAVE_EVERY_MS) return;
      lastSave = now;
      saving = saving.then(() =>
        pool.query(`UPDATE "BrainMessage" SET text = $2, activity = $3 WHERE id = $1 AND status = 'PROCESSING'`, [messageId, text, activity]).catch((e) => console.error("Brain progress save failed:", e)),
      );
    };

    try {
      const [conv, prior] = await Promise.all([
        pool.query<{ context: BrainContext }>(`SELECT context FROM "BrainConversation" WHERE id = $1`, [job.conversationId]),
        pool.query<{ role: "USER" | "ASSISTANT"; content: unknown; status: string }>(
          // (a question sorts before its reply: USER comes first in the BrainRole enum)
          `SELECT role, content, status FROM "BrainMessage" WHERE "conversationId" = $1 AND id <> $2 AND "createdAt" <= $3 ORDER BY "createdAt", role`,
          [job.conversationId, messageId, job.createdAt],
        ),
      ]);
      const context = conv.rows[0]?.context;
      if (!context) throw new BrainError("This chat couldn't be found.");

      // Replay exactly what Claude saw and said before (failed replies are left out).
      const history: MessageParam[] = [];
      for (const m of prior.rows) {
        if (m.role === "USER") history.push({ role: "user", content: m.content as MessageParam["content"] });
        else if (m.status === "COMPLETE" && Array.isArray(m.content)) history.push(...(await rehydrateDecks(m.content as MessageParam[], read)));
      }
      if (history[history.length - 1]?.role !== "user") throw new BrainError("There's no question to answer.");

      save("", "Thinking", true);
      const reply = await runBrainTurn({
        call: deps.call ?? defaultCall(),
        system: buildBrainSystem(context),
        setup: context.setup ?? 1,
        history,
        runTool: (name, input) => runBrainTool(name, input, { pool, readDeck: read }),
        onProgress: ({ text, activity }) => save(text, activity ?? (text ? null : "Thinking"), !!activity),
      });
      await saving;
      await pool.query(
        `UPDATE "BrainMessage" SET status = 'COMPLETE', text = $2, content = $3::jsonb, sources = $4::jsonb, activity = NULL,
           model = $5, "inputTokens" = $6, "outputTokens" = $7, "completedAt" = now() WHERE id = $1`,
        [messageId, reply.text, JSON.stringify(await dehydrateDecks(reply.appended)), JSON.stringify(reply.sources), reply.model, reply.inputTokens, reply.outputTokens],
      );
      await pool.query(`UPDATE "BrainConversation" SET "updatedAt" = now() WHERE id = $1`, [job.conversationId]);
    } catch (e) {
      await saving;
      const message =
        e instanceof BrainError
          ? e.message
          : e instanceof Anthropic.APIError
            ? `Claude API error (${e.status ?? "network"}). Try again in a minute.`
            : e instanceof Error
              ? e.message
              : "Unknown error";
      console.error(`Brain reply ${messageId} failed:`, e);
      await pool.query(`UPDATE "BrainMessage" SET status = 'FAILED', error = $2, activity = NULL, "completedAt" = now() WHERE id = $1`, [messageId, message.slice(0, 500)]);
    }
  } finally {
    if (ownPool) await pool.end();
  }
}
