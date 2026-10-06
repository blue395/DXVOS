"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

/** The public application link, with a Copy button. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-sm`} aria-label="Application link" />
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
  );
}
