// The "Forgot password?" emails: a one-time magic sign-in link or a password reset link.
// Pure (no server imports) so it can be tested.

export type LoginLinkEmailKind = "RESET" | "MAGIC";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function loginLinkEmail(kind: LoginLinkEmailKind, opts: { name: string; link: string; minutes: number }) {
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  const magic = kind === "MAGIC";
  const subject = magic ? "Your DXV sign-in link" : "Reset your DXV password";
  const lead = magic ? "Here's your link to sign in to DXV OS." : "Here's your link to set a new password for DXV OS.";
  const action = magic ? "Sign in to DXV" : "Set a new password";
  const small = `It works once, for the next ${opts.minutes} minutes. If you didn't ask for it, you can ignore this email: nothing changes until the link is used.`;

  const text = [`Hello ${first},`, "", lead, "", `${action}: ${opts.link}`, "", small, "", "DXV (Diversity X Ventures)"].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border:1px solid rgba(0,0,0,0.1);border-radius:10px">
<tr><td style="background:#1a3c35;padding:16px 24px;border-radius:10px 10px 0 0"><span style="background:#fbe45b;color:#1a3c35;font-weight:bold;letter-spacing:2px;font-size:12px;padding:2px 8px;border-radius:4px">DXV</span></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Hello ${escapeHtml(first)},</p>
<p style="margin:0 0 20px">${lead}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#1a3c35;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">${action}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#555555">${small}</p>
<p style="margin:0;font-size:12px;color:#777777;word-break:break-all">Or paste this into your browser: ${escapeHtml(opts.link)}</p>
</td></tr></table>
<p style="font-size:12px;color:#777777">DXV (Diversity X Ventures)</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}
