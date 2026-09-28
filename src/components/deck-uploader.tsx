"use client";

import { announceJobStarted } from "@/lib/job-events";
import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  beginDeckAnalysis,
  getDeckAnalysisStatus,
  startDeckUpload,
} from "@/app/(app)/deals/deck-actions";
import type { ExtractedFields } from "@/lib/deck-ai/schema";

const POLL_MS = 3000;
const MAX_BYTES = 20 * 1024 * 1024;

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
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
      return setPhase({ kind: "failed", message: "Upload the deck as a PDF." });
    }
    if (file.size > MAX_BYTES) return setPhase({ kind: "failed", message: "Decks must be 20 MB or smaller." });

    try {
      setPhase({ kind: "uploading", fileName: file.name });
      const start = await startDeckUpload({ fileName: file.name, fileSize: file.size, ventureId });
      if ("error" in start) return setPhase({ kind: "failed", message: start.error });

      if (start.target.kind === "supabase") {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
        const { error } = await sb.storage
          .from(start.target.bucket)
          .uploadToSignedUrl(start.target.path, start.target.token, file, { contentType: "application/pdf" });
        if (error) throw new Error(`Upload failed: ${error.message}`);
      } else {
        const res = await fetch(start.target.url, { method: "PUT", body: file });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      }

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
      setPhase({ kind: "failed", message: e instanceof Error ? e.message : "Something went wrong." });
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
