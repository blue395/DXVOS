"use client";

// A one-time sign-up or reset link, shown once with a Copy button (only its hash is stored).

import { useState } from "react";
import { buttonClass } from "./ui";

export function OneTimeLink({ url, expires }: { url: string; expires: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5 rounded-md border border-dxv-green/30 bg-dxv-green/[0.04] p-2 text-xs">
      <p className="text-black/70">
        Send this to them by WhatsApp or email. It works once, until {expires}, and is only shown now (make a new one if it&apos;s lost).
      </p>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded border border-black/15 bg-white px-2 py-1 font-mono" />
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
