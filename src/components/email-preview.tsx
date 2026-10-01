"use client";

// A live preview of a team email exactly as it renders (sandboxed: no scripts, no navigation).

import { renderMemberEmail } from "@/lib/member-email";

export function EmailPreview({ subject, body, firstName, link, bulk }: { subject: string; body: string; firstName: string; link: string; bulk: boolean }) {
  const mail = renderMemberEmail({ subject, body }, { first_name: firstName, platform_link: link }, bulk ? { unsubscribeUrl: "#unsubscribe" } : {});
  return (
    <div className="overflow-hidden rounded-lg border border-black/15 bg-white">
      <p className="border-b border-black/10 bg-black/[0.03] px-3 py-2 text-sm">
        <span className="text-black/50">Subject:</span> <strong>{mail.subject || "(no subject)"}</strong>
      </p>
      <iframe title="Email preview" sandbox="" srcDoc={mail.html} className="h-[680px] w-full" />
    </div>
  );
}
