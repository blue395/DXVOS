import "server-only";
// Founder submissions from the public /apply page (Blue, 2026-10-06). The browser uploads
// the deck straight to storage; then the deal is created (or the deck added to the deal
// already on the board), the AI reads it in full (eligibility screen: the AI suggests,
// the team decides), the founder gets an acknowledgement, and the partners a daily digest.
// Everything is filed by the "DXV website" system user, which can never sign in.

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { createUploadTarget, deckPath, objectExists, DECK_BUCKET, type UploadTarget } from "./deck-storage";
import { recordDeckDocument } from "./deck-documents";
import { runDeckAnalysis } from "./deck-worker";
import { founderFirstName, formTimingOk, matchExistingVenture, submissionLimitError, SubmissionSchema, type SubmissionInput } from "./founder-intake";
import { emailShell, escapeHtml } from "./login-email";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { renderMemberEmail, templateProblems } from "./member-email";
import { formatGbpCompact } from "./pipeline";
import { aiContextFor } from "./playbook/current";
import { triggerBackgroundJob } from "./trigger-worker";
import { hashIp } from "./client-ip";

export const SYSTEM_USER_ID = "system-website";
const DAY_MS = 86_400_000;
const secret = () => process.env.SESSION_SECRET ?? "";
const hmac = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url");

/** A signed "this form was shown at" stamp, so instant (bot) submissions can be told apart. */
export function issueFormToken(now = Date.now()): string {
  return `${now}.${hmac(`apply:${now}`)}`;
}
function formTokenTime(token: string): number | null {
  const [t, sig] = token.split(".");
  if (!t || !sig) return null;
  const expected = hmac(`apply:${t}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return Number(t);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type StartResult = { error: string } | { submissionId: string; completionToken: string; target: UploadTarget };

/** What the browser sends: raw answers, checked here (never trusted). */
export type RawSubmission = { [K in keyof SubmissionInput]?: unknown } & { formToken: string; trap?: string };

export async function startSubmission(input: RawSubmission, ip: string | null): Promise<StartResult> {
  // Bots fill every field, including the hidden one, and submit instantly. Tell them nothing.
  const shownAt = formTokenTime(String(input.formToken ?? ""));
  if (input.trap || shownAt === null || !formTimingOk(shownAt, Date.now())) {
    return { error: "Something went wrong with the form. Please refresh the page and try again." };
  }
  const parsed = SubmissionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  const ipHash = hashIp(ip);
  const [fromIpLastHour, fromEmailLastDay, totalLastDay] = await Promise.all([
    ipHash ? db.founderSubmission.count({ where: { ipHash, createdAt: { gt: new Date(Date.now() - 3_600_000) } } }) : 0,
    db.founderSubmission.count({ where: { email: d.email, createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
    db.founderSubmission.count({ where: { createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
  ]);
  const limited = submissionLimitError({ fromIpLastHour, fromEmailLastDay, totalLastDay });
  if (limited) return { error: limited };

  const analysisId = randomUUID();
  const storagePath = deckPath(analysisId, d.fileName);
  const completionToken = randomBytes(24).toString("base64url");
  const now = new Date();
  const [submission] = await db.$transaction([
    db.founderSubmission.create({
      data: {
        completionTokenHash: sha256(completionToken),
        companyName: d.companyName,
        founderNames: d.founderNames,
        email: d.email,
        website: d.website ?? null,
        linkedinUrl: d.linkedinUrl ?? null,
        sector: d.sector,
        companyStage: d.companyStage,
        raiseAmountGbp: d.raiseAmountGbp,
        pitch: d.pitch,
        heardFrom: d.heardFrom ?? null,
        diversityThemes: d.diversityThemes,
        privacyConsentAt: now,
        diversityConsentAt: d.diversityConsent && d.diversityThemes.length ? now : null,
        ipHash,
        analysisId,
      },
    }),
    db.deckAnalysis.create({ data: { id: analysisId, storagePath, fileName: d.fileName, fileSize: d.fileSize, createdById: SYSTEM_USER_ID } }),
  ]);
  try {
    return { submissionId: submission.id, completionToken, target: await createUploadTarget(storagePath, analysisId) };
  } catch (e) {
    console.error("Couldn't prepare a founder deck upload", e);
    return { error: "We couldn't prepare the upload just now. Please try again, or email your deck to angels@diversityx.vc." };
  }
}

export type CompleteResult = { error: string } | { ok: true };

/** The deck has uploaded: file the deal, start the AI reading, thank the founder. */
export async function completeSubmission(submissionId: string, completionToken: string): Promise<CompleteResult> {
  const sub = await db.founderSubmission.findUnique({ where: { id: submissionId } });
  const expired = { error: "This submission has expired. Please refresh the page and submit again." };
  if (!sub || sub.status !== "UPLOADING" || sub.completionTokenHash !== sha256(completionToken ?? "")) return expired;
  if (Date.now() - sub.createdAt.getTime() > 3_600_000) return expired;
  const analysis = sub.analysisId ? await db.deckAnalysis.findUnique({ where: { id: sub.analysisId } }) : null;
  if (!analysis || analysis.status !== "PENDING") return expired;
  if (!(await objectExists(DECK_BUCKET, analysis.storagePath))) return { error: "Your deck didn't finish uploading. Please try again." };

  // Claim it, so a double click can't file the deal twice.
  const claimed = await db.founderSubmission.updateMany({ where: { id: sub.id, status: "UPLOADING" }, data: { status: "COMPLETE", completedAt: new Date() } });
  if (claimed.count !== 1) return { ok: true };

  const existing = await db.venture.findMany({ select: { id: true, name: true, currentStage: true, createdAt: true } });
  const match = matchExistingVenture(sub.companyName, existing);
  let ventureId: string;
  if (match.mode === "resubmission") {
    ventureId = match.ventureId;
  } else {
    const venture = await db.venture.create({
      data: {
        name: sub.companyName,
        founderNames: sub.founderNames,
        founderEmail: sub.email,
        website: sub.website,
        sector: sub.sector,
        companyStage: sub.companyStage,
        raiseAmountGbp: sub.raiseAmountGbp,
        description: sub.pitch,
        founderDiversity: sub.diversityThemes,
        createdById: SYSTEM_USER_ID,
        stageChanges: {
          create: {
            fromStage: null,
            toStage: "SUBMITTED",
            changedById: SYSTEM_USER_ID,
            note: match.mode === "previously-declined" ? "Submitted via the website (DXV declined this company before)" : "Submitted via the website",
          },
        },
      },
    });
    ventureId = venture.id;
  }
  await db.$transaction([
    db.founderSubmission.update({
      where: { id: sub.id },
      data: { ventureId, resubmission: match.mode === "resubmission", previousVentureId: match.mode === "previously-declined" ? match.ventureId : null },
    }),
    db.deckAnalysis.update({ where: { id: analysis.id }, data: { ventureId, aiContext: await aiContextFor("ELIGIBILITY") } }),
  ]);
  await recordDeckDocument(analysis.id);
  const started = await triggerBackgroundJob({ functionName: "analyze-deck-background", subject: analysis.id, runInline: () => runDeckAnalysis(analysis.id) });
  if (!started) {
    await db.deckAnalysis.update({ where: { id: analysis.id }, data: { status: "FAILED", error: "The background worker couldn't be reached.", completedAt: new Date() } });
  }
  await sendAcknowledgement({ ...sub, ventureId });
  return { ok: true };
}

/** "Thanks, we've got it" from angels@diversityx.vc, using the team's template. Recorded either way. */
async function sendAcknowledgement(sub: { ventureId: string; email: string; founderNames: string; companyName: string }) {
  const t = await db.emailTemplate.findUnique({ where: { key: "founder-ack" } });
  if (!t || t.archivedAt || !mailConfigured() || templateProblems(t).length) return;
  const mail = renderMemberEmail(t, { first_name: founderFirstName(sub.founderNames), company: sub.companyName });
  let error: string | null = null;
  try {
    await sendMail({ to: sub.email, ...mail });
  } catch (e) {
    console.error("Founder acknowledgement failed", e);
    error = "Didn't send";
  }
  await db.founderEmail.create({ data: { ventureId: sub.ventureId, kind: "ACKNOWLEDGEMENT", to: sub.email, subject: mail.subject, body: mail.text, error } });
}

/**
 * The partners' morning email: website submissions since the last digest, each with the
 * AI's suggested verdict. Nothing is sent on a day with none.
 */
export async function sendFounderDigest(): Promise<{ submissions: number; sentTo: number }> {
  const subs = await db.founderSubmission.findMany({
    where: { status: "COMPLETE", digestedAt: null },
    orderBy: { completedAt: "asc" },
    include: { venture: { select: { id: true, name: true, currentStage: true, deckAnalyses: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, screen: true } } } } },
  });
  const origin = appOrigin();
  if (subs.length === 0 || !origin || !mailConfigured()) return { submissions: subs.length, sentTo: 0 };
  const partners = await db.user.findMany({ where: { role: "ADMIN", disabledAt: null }, select: { email: true, name: true } });
  const rows = subs.map((s) => {
    const screen = s.venture?.deckAnalyses[0]?.screen as { recommendation?: string; oneLineSummary?: string } | null;
    const verdict = screen?.recommendation ? `AI suggests: ${screen.recommendation}` : s.venture?.deckAnalyses[0]?.status === "FAILED" ? "AI reading failed: open the deal to re-run" : "AI still reading";
    const flag = s.resubmission ? " (new deck for a deal already on the board)" : s.previousVentureId ? " (declined before)" : "";
    return {
      text: `- ${s.companyName}${flag}: ${s.companyStage ?? ""}, ${s.sector ?? ""}, raising ${s.raiseAmountGbp ? formatGbpCompact(s.raiseAmountGbp) : "?"}. ${verdict}. ${origin}/deals/${s.ventureId}`,
      html: `<li style="margin:0 0 12px"><a href="${escapeHtml(`${origin}/deals/${s.ventureId}`)}" style="color:#1a3c35;font-weight:bold">${escapeHtml(s.companyName)}</a>${escapeHtml(flag)}<br><span style="color:#555555;font-size:13px">${escapeHtml(
        [s.companyStage, s.sector, s.raiseAmountGbp ? `raising ${formatGbpCompact(s.raiseAmountGbp)}` : null].filter(Boolean).join(" · "),
      )}</span><br><span style="font-size:13px">${escapeHtml(s.pitch)}</span><br><span style="font-size:13px;color:#1a3c35"><strong>${escapeHtml(verdict)}</strong></span></li>`,
    };
  });
  const subject = `${subs.length} new founder ${subs.length === 1 ? "submission" : "submissions"} for DXV`;
  for (const p of partners) {
    const first = p.name.split(" ")[0];
    await sendMail({
      to: p.email,
      subject,
      text: [`Hello ${first},`, "", `${subject} since the last digest:`, "", ...rows.map((r) => r.text), "", `All submissions: ${origin}/deals/submissions`].join("\n"),
      html: emailShell(
        `<p style="margin:0 0 12px">Hello ${escapeHtml(first)},</p><p style="margin:0 0 16px">${escapeHtml(subject)} since the last digest. The AI's verdicts are suggestions: the team decides.</p><ul style="padding-left:18px;margin:0 0 16px">${rows.map((r) => r.html).join("")}</ul><p style="margin:0"><a href="${escapeHtml(`${origin}/deals/submissions`)}" style="color:#1a3c35;font-weight:bold">See all website submissions</a></p>`,
      ),
    }).catch((e) => console.error("Digest email failed", p.email, e));
  }
  await db.founderSubmission.updateMany({ where: { id: { in: subs.map((s) => s.id) } }, data: { digestedAt: new Date() } });
  return { submissions: subs.length, sentTo: partners.length };
}
