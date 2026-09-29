"use client";

// Yellow banner offering a reload when DXV OS has been redeployed since this page was
// opened. Shown when an action fails because the page is out of date, and checked
// proactively whenever you come back to the tab (so the reload comes before the error).

import { useEffect, useState } from "react";
import { STALE_VERSION_EVENT, isStaleActionError } from "@/lib/stale-version";
import { buttonClass } from "./ui";

const THIS_VERSION = process.env.NEXT_PUBLIC_DEPLOY_ID ?? "local";

export function StaleVersionBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const show = () => setStale(true);
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleActionError(e.reason)) show();
    };
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version: string };
        if (version && version !== THIS_VERSION) show();
      } catch {
        // offline: check again next time
      }
    };
    window.addEventListener(STALE_VERSION_EVENT, show);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener(STALE_VERSION_EVENT, show);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!stale) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-3 bg-dxv-yellow px-4 py-2 text-sm text-dxv-green shadow-md">
      <span>
        <strong>DXV OS has been updated.</strong> Reload to get the latest version (anything unsaved on this page will need re-entering).
      </span>
      <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary")}>
        Reload
      </button>
    </div>
  );
}
