"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { confirmDocumentUpload, startDocumentUpload } from "@/app/(app)/deals/document-actions";
import { ACCEPT_ATTRIBUTE, CATEGORIES, CATEGORY_LABELS, checkUpload } from "@/lib/documents";
import { inputClass } from "@/components/ui";

/**
 * Upload PDF / Word / Excel files to a deal. Files go straight from the browser to
 * private storage (never through Netlify's request limit), then the upload is confirmed.
 * `category` fixes the category (e.g. Memo); otherwise the user picks one.
 */
export function DocumentUploader({
  ventureId,
  category,
  defaultCategory = "OTHER",
  ddItemId,
  compact = false,
  label,
}: {
  ventureId: string;
  category?: DocumentCategory;
  defaultCategory?: DocumentCategory;
  ddItemId?: string;
  compact?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<DocumentCategory>(category ?? defaultCategory);
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = status.kind === "busy";
  const inFlight = useRef(false); // ignore new files while an upload is running

  async function upload(files: FileList | File[]) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await uploadAll(files);
    } finally {
      inFlight.current = false;
    }
  }

  async function uploadAll(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const check = checkUpload(file.name, file.size);
      if ("error" in check) return setStatus({ kind: "error", text: `${file.name}: ${check.error}` });
      setStatus({ kind: "busy", text: `Uploading ${file.name}…` });
      try {
        const start = await startDocumentUpload({ ventureId, fileName: file.name, fileSize: file.size, category: chosen, ddItemId });
        if ("error" in start) throw new Error(start.error);
        if (start.target.kind === "supabase") {
          const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
          const { error } = await sb.storage
            .from(start.target.bucket)
            .uploadToSignedUrl(start.target.path, start.target.token, file, { contentType: check.mimeType });
          if (error) throw new Error(`Upload failed: ${error.message}`);
        } else {
          const res = await fetch(start.target.url, { method: "PUT", body: file });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        }
        const done = await confirmDocumentUpload(start.documentId);
        if (done.error) throw new Error(done.error);
      } catch (e) {
        return setStatus({ kind: "error", text: e instanceof Error ? e.message : "Upload failed." });
      }
    }
    setStatus({ kind: "idle" });
    router.refresh();
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_ATTRIBUTE}
      disabled={busy}
      className="hidden"
      onChange={(e) => {
        const files = e.target.files;
        if (files?.length) void upload(Array.from(files));
        e.target.value = "";
      }}
    />
  );
  const message =
    status.kind === "busy" ? (
      <span className="flex items-center gap-2 text-dxv-green" aria-live="polite">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-dxv-green border-t-transparent" />
        {status.text}
      </span>
    ) : status.kind === "error" ? (
      <span role="alert" className="rounded bg-dxv-yellow/30 px-2 py-0.5">
        {status.text}
      </span>
    ) : null;

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        {picker}
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-dxv-green hover:underline disabled:opacity-50">
          {label ?? "+ Attach file"}
        </button>
        {message}
      </span>
    );
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
        if (!busy && e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
      className={`flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed p-3 text-sm ${
        dragging ? "border-dxv-green bg-dxv-yellow/30" : "border-dxv-green/30 bg-dxv-green/[0.03]"
      }`}
    >
      {picker}
      {!category && (
        <select
          value={chosen}
          onChange={(e) => setChosen(e.target.value as DocumentCategory)}
          className={`${inputClass} w-auto`}
          aria-label="Document category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      )}
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="font-medium text-dxv-green hover:underline disabled:opacity-50">
        {label ?? "Drop files here or click to upload"}
      </button>
      <span className="text-xs text-black/45">PDF, Word or Excel, up to 50 MB</span>
      {message}
    </div>
  );
}
