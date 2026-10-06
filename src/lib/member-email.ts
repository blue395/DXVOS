// Emails the team writes to angels (the welcome email, bulk emails): a template with
// placeholders and simple links, rendered per person into plain text and HTML.
// Pure (no server imports) so it can be tested.
//
//   {{first_name}}      their first name
//   {{platform_link}}   their own one-time sign-up link (or the sign-in page once they're on)
//   {{company}}         the company (founder emails)
//   {{next_step}}       where the deal is going next (founder decision emails)
//   [link text](url)    a link; plain https:// addresses are linked too
//   A blank line starts a new paragraph; a single line break is kept (e.g. a signature).

import { emailShell, escapeHtml } from "./login-email";

export const PLACEHOLDERS = ["first_name", "platform_link", "company", "next_step"] as const;
export type EmailVars = { first_name: string; platform_link?: string; company?: string; next_step?: string };

/** Placeholders in a template that DXV OS doesn't fill in (typos like {{firstname}}). */
export function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(found.filter((p) => !(PLACEHOLDERS as readonly string[]).includes(p)))];
}

/** Bits left to fill in before a template can be sent (e.g. the WhatsApp link placeholder). */
export function unfinishedBits(text: string): string[] {
  return [...new Set([...text.matchAll(/PASTE-[A-Z0-9-]+/g)].map((m) => m[0]))];
}

/** Problems that stop a template being sent, in plain words (empty: fine). */
export function templateProblems(t: { subject: string; body: string }): string[] {
  const problems: string[] = [];
  if (!t.subject.trim()) problems.push("Add a subject.");
  if (!t.body.trim()) problems.push("Add the message.");
  for (const p of unknownPlaceholders(`${t.subject}\n${t.body}`)) problems.push(`{{${p}}} isn't a placeholder DXV OS knows (use {{first_name}}, {{platform_link}}, {{company}} or {{next_step}}).`);
  for (const b of unfinishedBits(t.body)) problems.push(`Replace ${b} with the real link.`);
  return problems;
}

/**
 * Names typed by founders and members (the public apply form, profiles) go into emails DXV
 * sends. Make them plain words, so nobody can slip a link or extra lines into an email from
 * DXV's address (e.g. a "company name" that's really a phishing link sent to someone else).
 */
export const inert = (s: string) =>
  s
    .replace(/[a-z][a-z0-9+.-]*:\/\//gi, "") // https://, ftp:// …
    .replace(/[[\]()<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const UNTRUSTED = new Set(["first_name", "company"]);

/** Replace the placeholders, leaving the rest (links, spacing) as written: for drafts a person edits. */
export const fill = (text: string, vars: EmailVars) =>
  text.replace(/\{\{\s*(first_name|platform_link|company|next_step)\s*\}\}/gi, (_, k: string) => {
    const key = k.toLowerCase() as keyof EmailVars;
    const v = vars[key] ?? "";
    return UNTRUSTED.has(key) ? inert(v) : v;
  });

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
const safeUrl = (u: string) => /^(https?:\/\/|mailto:)/i.test(u);

function lineToHtml(line: string): string {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    out += escapeHtml(line.slice(last, m.index));
    const [whole, text, url, bare] = m;
    const href = url ?? bare;
    out += safeUrl(href)
      ? `<a href="${escapeHtml(href)}" style="color:#1a3c35;font-weight:bold">${escapeHtml(text ?? bare)}</a>`
      : escapeHtml(whole);
    last = m.index + whole.length;
  }
  return out + escapeHtml(line.slice(last));
}

const lineToText = (line: string) => line.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1 ($2)");

/** One person's copy of a template. `unsubscribeUrl` adds the small-print unsubscribe line (bulk emails). */
export function renderMemberEmail(t: { subject: string; body: string }, vars: EmailVars, opts: { unsubscribeUrl?: string } = {}) {
  const subject = fill(t.subject, vars).replace(/\s+/g, " ").trim();
  const body = fill(t.body.replace(/\r\n/g, "\n"), vars).trim();
  const paragraphs = body.split(/\n\s*\n/);
  const html = emailShell(
    paragraphs.map((p) => `<p style="margin:0 0 14px">${p.split("\n").map(lineToHtml).join("<br>")}</p>`).join("\n"),
    opts.unsubscribeUrl
      ? `DXV (Diversity X Ventures). You're getting this as a DXV angel. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#777777">Unsubscribe from these emails</a>.`
      : undefined,
  );
  const text = [paragraphs.map((p) => p.split("\n").map(lineToText).join("\n")).join("\n\n"), opts.unsubscribeUrl ? `\n--\nUnsubscribe from these emails: ${opts.unsubscribeUrl}` : ""].join("");
  return { subject, text, html };
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";
