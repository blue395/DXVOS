import "server-only";
// Partners' emails to several founders at once (Deals → Email founders; Blue, 2026-11-05),
// e.g. the date of the pitch session. Who it goes to is decided by founderAudience()
// (pipeline.ts); sending happens in small batches from the email's page, each recipient
// claimed once so nobody gets two copies, and every copy is kept on its deal as a
// FounderEmail (kind BULK).

import { db } from "./db";
import { founderFirstName } from "./founder-intake";
import { mailConfigured, sendMail } from "./mail";
import { loadEmailAttachments, BATCH_SIZE } from "./member-emails";
import { renderMemberEmail } from "./member-email";
import { founderAudience, type FounderAudienceFilter } from "./pipeline";

/** Every deal a founder email could go to (imported past deals included: they only show with "Include declined"). */
export async function loadFounderAudienceDeals() {
  return db.venture.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, founderNames: true, founderEmail: true, currentStage: true, round: true },
  });
}

/** The deals a filter picks, re-checked on the server (the page's list is only a suggestion). */
export async function founderRecipients(filter: FounderAudienceFilter, ventureIds: string[]) {
  const chosen = new Set(ventureIds);
  return founderAudience(await loadFounderAudienceDeals(), filter).send.filter((v) => chosen.has(v.id));
}

export type BatchCounts = { sent: number; failed: number; pending: number; sending: number };

export async function founderBulkCounts(bulkEmailId: string): Promise<BatchCounts> {
  const counts = await db.founderBulkRecipient.groupBy({ by: ["status"], where: { bulkEmailId }, _count: true });
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return { sent: n("SENT"), failed: n("FAILED"), pending: n("PENDING"), sending: n("SENDING") };
}

/** Send the next few founders their copy. Returns what's left. */
export async function sendNextFounderBatch(bulkEmailId: string, actorId: string): Promise<BatchCounts> {
  const email = await db.founderBulkEmail.findUnique({ where: { id: bulkEmailId } });
  if (!email) throw new Error("Email not found.");
  if (!mailConfigured()) throw new Error("Email isn't set up.");
  const batch = await db.founderBulkRecipient.findMany({
    where: { bulkEmailId, status: "PENDING" },
    take: BATCH_SIZE,
    include: { venture: { select: { id: true, name: true, founderNames: true } } },
  });
  const attachments = batch.length ? await loadEmailAttachments({ founderBulkEmailId: bulkEmailId }) : { files: [], dealMaterial: false };
  for (const r of batch) {
    // Claim it first, so two tabs can't send the same copy twice.
    const claimed = await db.founderBulkRecipient.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "SENDING" } });
    if (claimed.count !== 1) continue;
    const mail = renderMemberEmail(email, { first_name: founderFirstName(r.venture.founderNames), company: r.venture.name });
    const copy = { ventureId: r.venture.id, kind: "BULK" as const, to: r.email, subject: mail.subject, body: mail.text, sentById: actorId, bulkEmailId };
    try {
      await sendMail({ to: r.email, ...mail, attachments: attachments.files });
      await db.$transaction([
        db.founderBulkRecipient.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), error: null } }),
        db.founderEmail.create({ data: copy }),
      ]);
    } catch (e) {
      console.error("Founder bulk email failed", e instanceof Error ? e.name : "error"); // no address: the failure is on the recipient row
      await db.$transaction([
        db.founderBulkRecipient.update({
          where: { id: r.id },
          data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 200) : "Didn't send" },
        }),
        db.founderEmail.create({ data: { ...copy, error: "Didn't send" } }),
      ]);
    }
  }
  return founderBulkCounts(bulkEmailId);
}
