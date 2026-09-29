"use client";

import { announceJobStarted } from "@/lib/job-events";
import { useRef, useState } from "react";
import {
  beginDeckAnalysis,
  getDeckAnalysisStatus,
  startDeckUpload,
} from "@/app/(app)/deals/deck-actions";
import type { ExtractedFields } from "@/lib/deck-ai/schema";
import { actionErrorMessage } from "@/lib/stale-version";
import { deckFileProblem, uploadDeckFile } from "@/lib/deck-upload-client";

const POLL_MS = 3000;

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "reading"; fileName: string }
  | { kind: "done"; fileName: string }
  | { kind: "failed"; message: string };

export type DeckResult = { analysisId: string; extracted: ExtractedFields | null };

/**
 * Upload a deck PDF and wait for the AI to read it.
 * The PDF goes straight from the browser to storage (never through Netlify's
 * request limit); the reading happens in a background job we poll.
 */
export function DeckUploader({
  ventureId,
  onComplete,
  label = "Drop the pitch deck here (PDF, up to 20 MB), or click to choose",
}: {
  ventureId?: string;
  onComplete: (result: DeckResult) => void;
  label?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase.kind === "uploading" || phase.kind === "reading";

  async function handleFile(file: File) {
    if (busy) return;
    const problem = deckFileProblem(file);
    if (problem) return setPhase({ kind: "failed", message: problem });

    try {
      setPhase({ kind: "uploading", fileName: file.name });
      const start = await startDeckUpload({ fileName: file.name, fileSize: file.size, ventureId });
      if ("error" in start) return setPhase({ kind: "failed", message: start.error });

      await uploadDeckFile(start.target, file);

      setPhase({ kind: "reading", fileName: file.name });
      const begun = await beginDeckAnalysis(start.analysisId);
      if (begun.error) throw new Error(begun.error);
      announceJobStarted();

      // Poll until the background job finishes (the server times stuck jobs out).
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const status = await getDeckAnalysisStatus(start.analysisId);
        if (!status) throw new Error("The analysis disappeared.");
        if (status.status === "FAILED") throw new Error(status.error ?? "Reading the deck failed.");
        if (status.status === "COMPLETE") {
          setPhase({ kind: "done", fileName: file.name });
          onComplete({ analysisId: start.analysisId, extracted: status.extracted });
          return;
        }
      }
    } catch (e) {
      setPhase({ kind: "failed", message: actionErrorMessage(e) });
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
      className={`rounded-lg border-2 border-dashed p-5 text-center text-sm transition ${
        dragging ? "border-dxv-green bg-dxv-yellow/30" : "border-dxv-green/30 bg-dxv-green/[0.03]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {phase.kind === "idle" && (
        <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-dxv-green hover:underline">
          {label}
        </button>
      )}
      {phase.kind === "uploading" && <Progress text={`Uploading ${phase.fileName}…`} />}
      {phase.kind === "reading" && (
        <Progress text={`Reading ${phase.fileName} and drafting the eligibility screen… usually under a minute.`} />
      )}
      {phase.kind === "done" && (
        <p className="text-dxv-green">
          Read <strong>{phase.fileName}</strong>.{" "}
          <button type="button" onClick={() => inputRef.current?.click()} className="underline">
            Use a different deck
          </button>
        </p>
      )}
      {phase.kind === "failed" && (
        <div role="alert" className="space-y-2">
          <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-left">{phase.message}</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-dxv-green hover:underline">
            Try another file
          </button>
        </div>
      )}
    </div>
  );
}

function Progress({ text }: { text: string }) {
  return (
    <p className="flex items-center justify-center gap-2 text-dxv-green" aria-live="polite">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
      {text}
    </p>
  );
}
