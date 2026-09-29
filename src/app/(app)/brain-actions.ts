"use server";

// DXV Brain: ask a question (starts a background reply) and archive chats. Chats are
// private: every lookup is scoped to the signed-in person.

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brainContext } from "@/lib/brain/snapshot";
import { questionNote } from "@/lib/brain/prompt";
import { chatTitle, dealIdFromPath, MAX_QUESTION_CHARS } from "@/lib/brain/page";
import { BRAIN_JOB_PREFIX, runBrainReply } from "@/lib/brain-worker";
import { effectiveDeckStatus } from "@/lib/deck-status";
import { stageLabel } from "@/lib/pipeline";
import { triggerBackgroundJob } from "@/lib/trigger-worker";
import type { ActionResult } from "@/lib/action-result";

const AskSchema = z.object({
  conversationId: z.string().nullable().optional(),
  question: z.string().trim().min(1, "Type a question.").max(MAX_QUESTION_CHARS, "That question is too long."),
  pagePath: z.string().max(300).startsWith("/").nullable().optional(),
});

export type AskResult = { error: string } | { conversationId: string; messageId: string };

export async function askBrain(input: z.input<typeof AskSchema>): Promise<AskResult> {
  const user = await requireAdmin();
  const parsed = AskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid question" };
  const { conversationId, question, pagePath } = parsed.data;
  const dealId = dealIdFromPath(pagePath);

  const [conversation, deal] = await Promise.all([
    conversationId
      ? db.brainConversation.findFirst({
          where: { id: conversationId, userId: user.id, archivedAt: null },
          select: { id: true, messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
        })
      : null,
    dealId ? db.venture.findUnique({ where: { id: dealId }, select: { id: true, name: true, currentStage: true } }) : null,
  ]);
  if (conversationId && !conversation) return { error: "That chat isn't available. Start a new one." };
  const lastReply = conversation?.messages[0];
  if (lastReply) {
    const s = effectiveDeckStatus(lastReply).status;
    if (s === "PENDING" || s === "PROCESSING") return { error: "The Brain is still answering. Wait for it to finish." };
  }

  const askedAt = new Date();
  const note = questionNote({ askedAt, pagePath: pagePath ?? null, deal: deal && { id: deal.id, name: deal.name, stage: stageLabel(deal.currentStage) } });
  const chatId =
    conversation?.id ??
    (await db.brainConversation.create({ data: { userId: user.id, title: chatTitle(question), context: await brainContext() }, select: { id: true } })).id;

  // The question, then its (pending) reply a millisecond later, so they always sort in order.
  const [, reply] = await db.$transaction([
    db.brainMessage.create({
      data: {
        conversationId: chatId,
        role: "USER",
        text: question,
        content: [{ type: "text", text: `${note}\n\n${question}` }],
        pagePath: pagePath ?? null,
        ventureId: deal?.id ?? null,
        createdAt: askedAt,
      },
    }),
    db.brainMessage.create({
      data: { conversationId: chatId, role: "ASSISTANT", status: "PENDING", createdAt: new Date(askedAt.getTime() + 1) },
      select: { id: true },
    }),
    db.brainConversation.update({ where: { id: chatId }, data: { updatedAt: askedAt } }),
  ]);

  const started = await triggerBackgroundJob({
    functionName: "brain-reply-background",
    subject: `${BRAIN_JOB_PREFIX}${reply.id}`,
    runInline: () => runBrainReply(reply.id),
  });
  if (!started) {
    await db.brainMessage.update({
      where: { id: reply.id },
      data: { status: "FAILED", error: "The background worker couldn't be reached. Check the Netlify function deployed.", completedAt: new Date() },
    });
  }
  return { conversationId: chatId, messageId: reply.id };
}

/** Hide a chat from the list (kept, not deleted). */
export async function archiveBrainChat(conversationId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const { count } = await db.brainConversation.updateMany({ where: { id: conversationId, userId: user.id }, data: { archivedAt: new Date() } });
  return count ? { ok: true } : { error: "That chat isn't available." };
}
