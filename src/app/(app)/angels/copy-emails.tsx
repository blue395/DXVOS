"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

/** Copies the listed angels' emails, ready to paste into Bcc. */
export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!emails.length}
      className={buttonClass("secondary")}
      title="Copy these angels' emails, separated by semicolons (paste into Bcc)"
      onClick={async () => {
        await navigator.clipboard.writeText(emails.join("; "));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? `✓ Copied ${emails.length}` : `Copy emails (${emails.length})`}
    </button>
  );
}
