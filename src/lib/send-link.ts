import "server-only";
// Emailing the one-time links the team makes (member invites, team invites, password
// resets). The link is always returned too, so if email fails the team can still copy it.
import { sentLinkEmail, type TeamSentLinkKind } from "./login-email";
import { appOrigin, mailConfigured, sendMail } from "./mail";
import { requestOrigin } from "./request-origin";

export type EmailOutcome = { emailedTo?: string; emailError?: string };

/** Where links point: the fixed site address when set (always for emailed links), else as the visitor reached it. */
export async function linkOrigin(): Promise<string> {
  return appOrigin() ?? (await requestOrigin());
}

export async function emailSentLink(
  kind: TeamSentLinkKind,
  to: string,
  opts: { name: string; link: string; expiresAt: Date; sentBy: string },
): Promise<EmailOutcome> {
  if (!mailConfigured() || !appOrigin()) return { emailError: "Email isn't set up, so copy the link below and send it yourself." };
  try {
    await sendMail({ to, ...sentLinkEmail(kind, opts) });
    return { emailedTo: to };
  } catch (e) {
    console.error("Emailing a link failed", e);
    return { emailError: "The email didn't send, so copy the link below and send it yourself." };
  }
}
