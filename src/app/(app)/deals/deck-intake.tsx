"use client";

// Drop founder decks on the board's Submitted column (or click to choose them).
// Each PDF becomes a new Submitted deal with the deck stored under its Documents;
// a quick AI read fills in the company name, primary founder and stage. The
// eligibility screen is run later, from the deal page.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceJobStarted } from "@/lib/job-events";
import { deckFileProblem, uploadDeckFile } from "@/lib/deck-upload-client";
import { actionErrorMessage } from "@/lib/stale-version";
import { Spinner } from "@/components/ui";
import { finishDeckIntake, startDeckIntake } from "./deck-actions";

type Upload = { key: string; fileName: string; state: "uploading" | "done" | "failed"; message?: string };

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/** `header`: the column header; `children`: its cards. The drop box sits between them. */
export function DeckIntake({ round, header, children }: { round: number | null; header: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const depth = useRef(0); // dragenter/leave fire for every child element; count them
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Upload>) => setUploads((us) => us.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  async function file(f: File) {
    const key = `${f.name}-${f.size}-${Math.random()}`;
    setUploads((us) => [...us, { key, fileName: f.name, state: "uploading" }]);
    const problem = deckFileProblem(f);
    if (problem) return update(key, { state: "failed", message: problem });
    try {
      const start = await startDeckIntake({ fileName: f.name, fileSize: f.size, round });
      if ("error" in start) return update(key, { state: "failed", message: start.error });
      await uploadDeckFile(start.target, f);
      const done = await finishDeckIntake(start.analysisId, round);
      if (done.error) return update(key, { state: "failed", message: done.error });
      update(key, { state: "done" });
      announceJobStarted(); // the job tray follows the read and refreshes the board when it's done
      router.refresh(); // the new card appears now, marked "Reading deck…"
      setTimeout(() => setUploads((us) => us.filter((u) => u.key !== key)), 4000);
    } catch (e) {
      update(key, { state: "failed", message: actionErrorMessage(e) });
    }
  }

  const addFiles = (files: FileList | null) => Array.from(files ?? []).forEach((f) => void file(f));

  return (
    <div
      className={`flex flex-1 flex-col rounded-[11px] transition ${over ? "bg-dxv-yellow/30 ring-2 ring-inset ring-dxv-green" : ""}`}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {header}
      <div className="px-2 pt-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs transition hover:border-dxv-green hover:bg-white active:scale-[0.99] ${
            over ? "border-dxv-green bg-white" : "border-dxv-green/30"
          }`}
        >
          <span className="block font-semibold text-dxv-green">{over ? "Drop to file these decks" : "+ Drop founder decks here"}</span>
          <span className="block text-black/50">or click to choose · PDF, up to 20 MB</span>
        </button>
        {uploads.length > 0 && (
          <ul className="mt-2 space-y-1" aria-live="polite">
            {uploads.map((u) => (
              <li key={u.key} className="flex items-start gap-1.5 rounded-md bg-white px-2 py-1.5 text-[11px] ring-1 ring-black/10">
                {u.state === "uploading" && <Spinner className="mt-px h-3 w-3 shrink-0 text-dxv-green" />}
                {u.state === "done" && <span className="shrink-0 font-semibold text-dxv-green">✓</span>}
                {u.state === "failed" && <span className="shrink-0 font-semibold text-black">!</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-black/80" title={u.fileName}>
                    {u.fileName}
                  </span>
                  <span className={u.state === "failed" ? "block bg-dxv-yellow/60 px-1 text-black" : "block text-black/50"}>
                    {u.state === "uploading" ? "Uploading…" : u.state === "done" ? "Filed. Reading name, founder and stage…" : u.message}
                  </span>
                </span>
                {u.state === "failed" && (
                  <button
                    type="button"
                    onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))}
                    className="shrink-0 text-black/40 hover:text-black"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </div>
  );
}
