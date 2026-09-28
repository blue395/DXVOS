"use client";

// Thin yellow bar across the top of the screen while a page is loading, so every
// click on a link gets instant feedback. Starts on any internal link click, and
// completes when the URL changes.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = search ? `${pathname}?${search}` : pathname;
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastUrl, setLastUrl] = useState(url);

  // The URL changed: the new page is here (adjust-state-on-change pattern, no effect).
  if (url !== lastUrl) {
    setLastUrl(url);
    if (phase === "loading") setPhase("done");
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // (No defaultPrevented check: Next's <Link> cancels the default itself and navigates.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname.startsWith("/api/")) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return; // same page / hash
      setPhase("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (phase === "idle") return;
    // Fade out after finishing; give up quietly if a click never led anywhere.
    const t = setTimeout(() => setPhase("idle"), phase === "done" ? 400 : 10_000);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className={`h-full bg-dxv-yellow shadow-[0_0_8px_var(--color-dxv-yellow)] ${
          phase === "idle"
            ? "w-0 opacity-0"
            : phase === "loading"
              ? "w-[85%] opacity-100 transition-[width] duration-[8000ms] ease-out"
              : "w-full opacity-0 transition-[width,opacity] duration-300"
        }`}
      />
    </div>
  );
}
