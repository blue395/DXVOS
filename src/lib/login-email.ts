// DXV OS's emails: one-time sign-in / reset links (asked for on the sign-in page) and
// invite / reset links the team sends. One layout, in DXV's colours. Pure (no server
// imports) so it can be tested.

export type LoginLinkEmailKind = "RESET" | "MAGIC";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** A DXV email: greeting, a short lead, one button, small print, and the link written out. */
function linkEmail(opts: { subject: string; name: string; lead: string; action: string; link: string; small: string }) {
  const first = firstName(opts.name);
  const text = [`Hello ${first},`, "", opts.lead, "", `${opts.action}: ${opts.link}`, "", opts.small, "", "DXV (Diversity X Ventures)"].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border:1px solid rgba(0,0,0,0.1);border-radius:10px">
<tr><td style="background:#1a3c35;padding:16px 24px;border-radius:10px 10px 0 0"><span style="background:#fbe45b;color:#1a3c35;font-weight:bold;letter-spacing:2px;font-size:12px;padding:2px 8px;border-radius:4px">DXV</span></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Hello ${escapeHtml(first)},</p>
<p style="margin:0 0 20px">${escapeHtml(opts.lead)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#1a3c35;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">${escapeHtml(opts.action)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#555555">${escapeHtml(opts.small)}</p>
<p style="margin:0;font-size:12px;color:#777777;word-break:break-all">Or paste this into your browser: ${escapeHtml(opts.link)}</p>
</td></tr></table>
<p style="font-size:12px;color:#777777">DXV (Diversity X Ventures)</p>
</td></tr></table></body></html>`;
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
