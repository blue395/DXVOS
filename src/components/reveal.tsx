"use client";

// "+ Record vote"-style button that opens a form in place. Forms inside close
// themselves after a successful save (ActionForm calls `close`), and their
// SubmitButton gets a Cancel next to it.

import { createContext, useState } from "react";
import { buttonClass, type ButtonVariant } from "./ui";

export const RevealContext = createContext<{ close: (saved: boolean) => void } | null>(null);

export function Reveal({
  label,
  children,
  variant = "secondary",
  savedLabel = "✓ Saved",
  buttonClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  variant?: ButtonVariant;
  savedLabel?: string;
  /** Overrides the button style (e.g. the Decline pill). */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) {
    return (
      <button type="button" aria-expanded={false} onClick={() => setOpen(true)} className={buttonClassName ?? buttonClass(variant)}>
        {saved ? savedLabel : label}
      </button>
    );
  }
  return (
    <RevealContext.Provider
      value={{
        close: (didSave) => {
          setOpen(false);
          if (didSave) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }
        },
      }}
    >
      <div className="w-full basis-full rounded-lg border border-dxv-green/20 bg-dxv-green/[0.03] p-3">{children}</div>
    </RevealContext.Provider>
  );
}
