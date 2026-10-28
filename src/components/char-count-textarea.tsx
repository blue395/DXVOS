"use client";

// A textarea with a live "120 / 2000" counter. Uncontrolled (typing before hydration
// can't be lost or doubled); the counter only reads its length.

import { useState } from "react";

export function CharCountTextarea({
  maxLength,
  defaultValue = "",
  id,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { maxLength: number; defaultValue?: string; id: string }) {
  const [count, setCount] = useState(defaultValue.length);
  return (
    <>
      <textarea
        {...rest}
        id={id}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-describedby={`${id}-count`}
        onInput={(e) => setCount(e.currentTarget.value.length)}
      />
      <span id={`${id}-count`} className={`block text-right text-xs ${count >= maxLength ? "font-medium text-dxv-green" : "text-black/50"}`} aria-live="polite">
        {count.toLocaleString("en-GB")} / {maxLength.toLocaleString("en-GB")}
      </span>
    </>
  );
}
