"use client";

// The burger menu for narrow screens (team app and member portal headers). The links are
// passed in as children; the panel closes when a link is followed, on Escape, or on a tap
// outside it.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function MobileMenu({ children, className = "", label = "Menu" }: { children: React.ReactNode; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  // A new page: close (adjust-state-on-change, no effect needed).
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-white/10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main menu"
          className="absolute inset-x-0 top-full z-[70] border-t border-white/10 bg-dxv-green px-4 pt-2 pb-4 text-white shadow-xl"
        >
          <div className="mx-auto flex max-w-[1600px] flex-col gap-1">{children}</div>
        </nav>
      )}
    </div>
  );
}

/** A divider between groups of links in the burger menu. */
export function MenuDivider() {
  return <hr className="my-2 border-white/15" />;
}
