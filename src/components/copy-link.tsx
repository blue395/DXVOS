"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

/** A link with a Copy button (the founder application link, shareable sign-up links). */
export function CopyLink({ url, label = "Link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-sm`} aria-label={label} />
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
