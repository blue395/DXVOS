"use client";

// Floating tray (bottom right, every page) for long AI jobs: eligibility screen,
// investment assessment, DD document. Shows elapsed time and an estimated progress
// bar, then "ready: open" when done. It checks /api/jobs only while something is
// running (or just started), and refreshes the page you're on when its job finishes,
// so pages don't need to poll themselves.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { JOB_STARTED_EVENT } from "@/lib/job-events";
import { Spinner } from "@/components/ui";
import { estimatedProgress, formatElapsed, isRunning, JOB_KINDS, type Job } from "@/lib/jobs";

const POLL_MS = 3000;
const GRACE_MS = 12_000; // keep looking this long after a start, before the job is claimed

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function writeSet(key: string, s: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify([...s].slice(-50)));
  } catch {
    // storage unavailable: the tray still works for this page view
  }
}

/** The deal a job belongs to, e.g. "/deals/abc" (for refreshing the right page). */
const dealPath = (href: string) => href.split(/[?#]/)[0].split("/").slice(0, 3).join("/");

export function JobTray() {
  const router = useRouter();
  const pathname = usePathname();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const graceUntil = useRef(0);
  const startedSince = useRef(Infinity); // jobs started after a "job started" signal count as ours
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRunning = useRef<Map<string, string>>(new Map()); // id -> href
  const checkRef = useRef<() => void>(() => {});

  const check = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let list: Job[] = [];
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (res.ok) list = ((await res.json()) as { jobs: Job[] }).jobs;
    } catch {
      // offline or signed out: try again on the next event
    }
    const running = list.filter(isRunning);

    // Remember what this browser saw running (or started), so it can announce the finish.
    const nextSeen = readSet("dxv-jobs-seen");
    const newlySeen = list.filter(
      (j) => !nextSeen.has(j.id) && (isRunning(j) || new Date(j.startedAt).getTime() >= startedSince.current),
    );
    newlySeen.forEach((j) => nextSeen.add(j.id));
    writeSet("dxv-jobs-seen", nextSeen);

    // A job we watched just finished: refresh the page if it's showing that deal, or the
    // board (its cards show deck state, e.g. a dropped deck's name filled in).
    const finishedHrefs = [
      ...[...prevRunning.current].filter(([id]) => !running.some((j) => j.id === id)).map(([, href]) => href),
      ...newlySeen.filter((j) => !isRunning(j)).map((j) => j.href),
    ];
    const here = window.location.pathname;
    if (finishedHrefs.length > 0 && (here === "/deals" || finishedHrefs.some((href) => here.startsWith(dealPath(href))))) router.refresh();
    prevRunning.current = new Map(running.map((j) => [j.id, j.href]));

    setSeen(nextSeen);
    setDismissed(readSet("dxv-jobs-dismissed"));
    setJobs(list);
    setNow(Date.now());
    if (running.length > 0 || Date.now() < graceUntil.current) timer.current = setTimeout(() => checkRef.current(), POLL_MS);
  }, [router]);

  useEffect(() => {
    checkRef.current = () => void check();
  }, [check]);

  // Look on first load and on page changes (someone else may have started a job),
  // at most every 15 seconds unless something is already being watched.
  const lastPageCheck = useRef(0);
  useEffect(() => {
    if (Date.now() - lastPageCheck.current < 15_000) return;
    lastPageCheck.current = Date.now();
    void check();
  }, [check, pathname]);

  useEffect(() => {
    const onStart = () => {
      graceUntil.current = Date.now() + GRACE_MS;
      startedSince.current = Math.min(startedSince.current, Date.now() - 10_000); // allow for clock skew
      void check();
    };
    window.addEventListener(JOB_STARTED_EVENT, onStart);
    return () => {
      window.removeEventListener(JOB_STARTED_EVENT, onStart);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  const visible = jobs.filter((j) => (isRunning(j) || seen.has(j.id)) && !dismissed.has(j.id)).slice(0, 4);
  const anyRunning = visible.some(isRunning);

  // Tick the elapsed clocks once a second while something runs.
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyRunning]);

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const d = readSet("dxv-jobs-dismissed");
    d.add(id);
    writeSet("dxv-jobs-dismissed", d);
    setDismissed(d);
  };

  return (
    <div aria-live="polite" className="fixed right-4 bottom-20 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
      {visible.map((j) => {
        const kind = JOB_KINDS[j.kind];
        const elapsed = now - new Date(j.startedAt).getTime();
        const running = isRunning(j);
        return (
          <div key={j.id} className="overflow-hidden rounded-lg border border-dxv-green/20 bg-white shadow-lg">
            <div className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-dxv-green">
                  {running && <Spinner className="h-3 w-3" />}
                  <span className="truncate">
                    {kind.label} · {j.ventureName}
                  </span>
                </p>
                {running ? (
                  <p className="text-xs text-black/55">
                    Working… {formatElapsed(elapsed)} · {kind.usually}. You can keep working.
                  </p>
                ) : j.status === "COMPLETE" ? (
                  <p className="text-xs text-dxv-green">
                    <span aria-hidden>✓ </span>
                    {j.result ?? "Done"}.{" "}
                    <Link href={j.href} onClick={() => dismiss(j.id)} className="font-semibold underline underline-offset-2 hover:no-underline">
                      Open
                    </Link>
                  </p>
                ) : (
                  <p className="text-xs">
                    Couldn&apos;t finish: {j.error ?? "unknown error"}.{" "}
                    <Link href={j.href} onClick={() => dismiss(j.id)} className="font-semibold text-dxv-green underline underline-offset-2">
                      Open
                    </Link>
                  </p>
                )}
              </div>
              {!running && (
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(j.id)}
                  className="-mr-1 rounded px-1.5 text-black/40 transition hover:bg-black/5 hover:text-black"
                >
                  ×
                </button>
              )}
            </div>
            <div className="h-1.5 bg-dxv-green/10">
              <div
                className={`h-full transition-[width] duration-1000 ease-out ${
                  running ? "animate-pulse bg-dxv-yellow" : j.status === "COMPLETE" ? "bg-dxv-green" : "bg-dxv-yellow"
                }`}
                style={{ width: `${running ? estimatedProgress(elapsed, kind.expectedSeconds) : 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
