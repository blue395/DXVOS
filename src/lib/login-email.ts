// DXV OS's emails: one-time sign-in / reset links (asked for on the sign-in page) and
// invite / reset links the team sends. One layout, in DXV's colours. Pure (no server
// imports) so it can be tested.

import { inert } from "./member-email";

export type LoginLinkEmailKind = "RESET" | "MAGIC";

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** The DXV frame every email shares: green header with the yellow DXV tag, white card, footer. `inner` is trusted HTML. */
export function emailShell(inner: string, footer = "DXV (Diversity X Ventures)") {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid rgba(0,0,0,0.1);border-radius:10px">
<tr><td style="background:#1a3c35;padding:16px 24px;border-radius:10px 10px 0 0"><span style="background:#fbe45b;color:#1a3c35;font-weight:bold;letter-spacing:2px;font-size:12px;padding:2px 8px;border-radius:4px">DXV</span></td></tr>
<tr><td style="padding:24px;line-height:1.5">
${inner}
</td></tr></table>
<p style="font-size:12px;color:#777777;max-width:560px">${footer}</p>
</td></tr></table></body></html>`;
}

/** A DXV email: greeting, a short lead, one button, small print, and the link written out. */
function linkEmail(opts: { subject: string; name: string; lead: string; action: string; link: string; small: string }) {
  const first = firstName(opts.name);
  const text = [`Hello ${first},`, "", opts.lead, "", `${opts.action}: ${opts.link}`, "", opts.small, "", "DXV (Diversity X Ventures)"].join("\n");
  const html = emailShell(`<p style="margin:0 0 12px">Hello ${escapeHtml(first)},</p>
<p style="margin:0 0 20px">${escapeHtml(opts.lead)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#1a3c35;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">${escapeHtml(opts.action)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#555555">${escapeHtml(opts.small)}</p>
<p style="margin:0;font-size:12px;color:#777777;word-break:break-all">Or paste this into your browser: ${escapeHtml(opts.link)}</p>`);
  return { subject: opts.subject, text, html };
}

/** "Forgot password?" emails: a magic sign-in link or a password reset link. */
export function loginLinkEmail(kind: LoginLinkEmailKind, opts: { name: string; link: string; minutes: number }) {
  const magic = kind === "MAGIC";
  return linkEmail({
    subject: magic ? "Your DXV sign-in link" : "Reset your DXV password",
    name: opts.name,
    lead: magic ? "Here's your link to sign in to DXV OS." : "Here's your link to set a new password for DXV OS.",
    action: magic ? "Sign in to DXV" : "Set a new password",
    link: opts.link,
    small: `It works once, for the next ${opts.minutes} minutes. If you didn't ask for it, you can ignore this email: nothing changes until the link is used.`,
  });
}

export type TeamSentLinkKind = "MEMBER_INVITE" | "TEAM_INVITE" | "RESET";

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });

/** Links the team sends: a member portal invite, a team app invite, or a password reset. */
export function sentLinkEmail(kind: TeamSentLinkKind, opts: { name: string; link: string; expiresAt: Date; sentBy: string }) {
  const by = firstName(opts.sentBy);
  const until = `The link works once, until ${longDate(opts.expiresAt)}.`;
  if (kind === "RESET") {
    return linkEmail({
      subject: "Set a new DXV password",
      name: opts.name,
      lead: `${by} from the DXV team has sent you a link to set a new password for DXV OS.`,
      action: "Set a new password",
      link: opts.link,
      small: `${until} If you didn't expect it, you can ignore this email: your password only changes if the link is used.`,
    });
  }
  if (kind === "TEAM_INVITE") {
    return linkEmail({
      subject: "You're invited to DXV OS",
      name: opts.name,
      lead: `${by} has invited you to DXV OS, the DXV team's app. Choose a password to set up your login.`,
      action: "Set up my login",
      link: opts.link,
      small: `${until} If you weren't expecting this, you can ignore this email.`,
    });
  }
  return linkEmail({
    subject: "Your invitation to the DXV members' portal",
    name: opts.name,
    lead: `${by} has invited you to the DXV members' portal. Setting up takes a few minutes: choose a password and accept the member terms, confirm your details, then complete your investor statement.`,
    action: "Set up my login",
    link: opts.link,
    small: `${until} If you weren't expecting this, you can ignore this email.`,
  });
}

/** Sent to the OLD address when someone switches their DXV email, so a hijack wouldn't go unnoticed. */
export function emailChangedEmail(opts: { name: string; oldEmail: string; newEmail: string; via: string; signInUrl: string }) {
  return linkEmail({
    subject: "Your DXV email has changed",
    name: opts.name,
    lead: `Your DXV OS login email was changed from ${opts.oldEmail} to ${opts.newEmail}, using your connected ${opts.via} account. From now on, sign in with ${opts.newEmail}.`,
    action: "Sign in to DXV",
    link: opts.signInUrl,
    small: "If this wasn't you, reply to this email straight away and the DXV team will lock the account.",
  });
}

/** Retention: their account will be deleted after 24 months without activity unless they sign in. */
export function inactivityWarningEmail(opts: { name: string; deleteOn: string; signInUrl: string }) {
  return linkEmail({
    subject: "Your DXV account: sign in to keep it",
    name: opts.name,
    lead: `Your DXV OS account hasn't been used for two years. To keep the personal data we hold to a minimum, we'll delete your account on ${opts.deleteOn}. If you'd like to stay a DXV member, just sign in before then.`,
    action: "Sign in to keep my account",
    link: opts.signInUrl,
    small: "Amounts from any investments you made through DXV are kept, without your name, for our records. Questions? Reply to this email.",
  });
}

/** Shareable sign-up link: "confirm your email" (the first step of asking to join). */
export function joinConfirmEmail(opts: { name: string; link: string; hours: number }) {
  return linkEmail({
    subject: "Confirm your email to join DXV",
    name: opts.name,
    lead: "Thanks for asking to join the DXV angel syndicate. Please confirm this is your email. The DXV team then reviews your request and emails you a personal sign-up link.",
    action: "Confirm my email",
    link: opts.link,
    small: `The link works once, for ${opts.hours} hours. If you didn't ask to join DXV, you can ignore this email.`,
  });
}

/**
 * Shareable sign-up link, for someone who already has a DXV login: sign in instead. When
 * their record's login uses a different email, `loginEmailHint` (partly hidden) says which.
 */
export function joinAlreadyMemberEmail(opts: { name: string; signInUrl: string; loginEmailHint?: string | null }) {
  return linkEmail({
    subject: "You already have DXV access",
    name: opts.name,
    lead: opts.loginEmailHint
      ? `Someone (hopefully you) asked to join DXV with this email. You're already on DXV, but your login uses a different email address: ${opts.loginEmailHint}. Sign in with that address (or "Continue with Google" if it's a Google account). Not sure of the password? Use "Email me a sign-in link" or "Forgot your password?" on the sign-in page, with that address.`
      : 'Someone (hopefully you) asked to join DXV with this email, and you already have a login. Sign in below. Forgotten your password? Use "Forgot your password?" on the sign-in page.',
    action: "Sign in to DXV",
    link: opts.signInUrl,
    small: "If you didn't ask, you can ignore this email: nothing has changed.",
  });
}

/** To partners: someone confirmed their email through a shareable link and is waiting for approval. */
export function joinRequestPartnerEmail(opts: { partnerName: string; name: string; email: string; label: string; matched: string | null; reviewUrl: string }) {
  return linkEmail({
    subject: `Join request: ${opts.name}`,
    name: opts.partnerName,
    lead: `${opts.name} (${opts.email}) asked to join DXV through the link "${opts.label}" and has confirmed their email. ${
      opts.matched
        ? `They're already in the directory as ${opts.matched}, so approving links them to that record.`
        : "They're not in the directory yet: approving adds them as a Prospect."
    } Approve to email them a personal sign-up link, or decline.`,
    action: "Review join requests",
    link: opts.reviewUrl,
    small: "They only get a sign-up link once a partner approves.",
  });
}

/** To partners: someone joined through an instant link (nothing to approve; for awareness). */
export function joinInstantPartnerEmail(opts: { partnerName: string; name: string; email: string; label: string; matched: string | null; angelUrl: string }) {
  return linkEmail({
    subject: `New member signing up: ${opts.name}`,
    name: opts.partnerName,
    lead: `${opts.name} (${opts.email}) has signed up through the instant link "${opts.label}" and is setting up their account now. ${
      opts.matched ? `They were already in the directory as ${opts.matched}, so they've been linked to that record.` : "They've been added as a new member."
    } They'll see deals once they've signed their investor statement on the platform. If they shouldn't be here, switch off their access from their page.`,
    action: "Open their record",
    link: opts.angelUrl,
    small: "Instant links are capped and expire. Switch a link off any time on Angels → Invite an angel.",
  });
}

/**
 * To the team inbox when a member signs their investor statement in the portal (Blue,
 * 2026-11-06). Only what the team needs to follow up: who, which statement, set-up or
 * renewal. Never the criteria ticked, the typed signature or the IP (those stay on the record).
 */
export function statementSignedTeamEmail(opts: {
  name: string;
  email: string | null;
  statement: string;
  firstTime: boolean;
  dealAccess: boolean;
  angelUrl: string;
}) {
  const name = inert(opts.name) || "A member"; // typed by the member: plain words only
  const who = opts.email ? `${name} (${opts.email})` : name;
  return linkEmail({
    subject: opts.firstTime ? `New member set up: ${name}` : `Investor statement renewed: ${name}`,
    name: "DXV team",
    lead: opts.firstTime
      ? `${who} has finished setting up their account and signed the ${opts.statement} on the platform. ${
          opts.dealAccess
            ? "They can now see the deals DXV shares with members."
            : "Their record isn't a current Member, so they won't see deals until that's changed on their page."
        }`
      : `${who} has signed the ${opts.statement} again on the platform, so their deal access carries on.`,
    action: "Open their record",
    link: opts.angelUrl,
    small: "Sent to the DXV inbox each time a member signs an investor statement on DXV OS.",
  });
}
