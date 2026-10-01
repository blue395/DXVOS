import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Outgoing email (sign-in links). Sends over SMTP: DXV uses its Google Workspace account
// (smtp.gmail.com with an app password; see docs/DEPLOY.md). Any SMTP service works by
// changing the settings. Without them, production sends nothing and the sign-in page hides
// the email options; local development prints each email to the server console instead.

export type Mail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };

const isProduction = () => process.env.NODE_ENV === "production";

const smtpReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);

/**
 * The site's fixed address for links in emails. Never taken from the request: a forged
 * Host header would otherwise put an attacker's address in someone's reset email.
 * APP_URL, else Netlify's own URL; local development falls back to localhost.
 */
export function appOrigin(): string | null {
  const url = process.env.APP_URL || process.env.URL;
  if (url) return url.replace(/\/+$/, "");
  return isProduction() ? null : `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Whether DXV OS can email sign-in links (in development it always "can": emails go to the console). */
export function mailConfigured(): boolean {
  if (!appOrigin()) return false;
  return smtpReady() || !isProduction();
}

let transport: Transporter | null = null;

export async function sendMail(mail: Mail): Promise<void> {
  if (!smtpReady()) {
    if (isProduction()) throw new Error("Email isn't set up (SMTP settings missing).");
    console.log(`\n── Email (dev: not sent) ──\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n──\n`);
    return;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465: TLS from the start; 587: upgraded with STARTTLS
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers });
}
