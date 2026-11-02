"use client";

// The composer's attachments: upload files (straight to storage) or attach an approved
// opportunities pack. Drafts until the email is sent.

import { useRef, useState, useTransition } from "react";
import { Spinner, buttonClass, inputClass } from "@/components/ui";
import { formatFileSize } from "@/lib/documents";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS } from "@/lib/email-attachments";
import { uploadFile } from "@/lib/deck-upload-client";
import { actionErrorMessage } from "@/lib/stale-version";
import { attachOpportunityPack, confirmAttachmentUpload, removeDraftAttachment, startAttachmentUpload, type DraftAttachment } from "../attachment-actions";

export type PackOption = { id: string; title: string; round: number; number: number };

export function Attachments({
  value,
  onChange,
  packs,
}: {
  value: DraftAttachment[];
  /** A state setter: updates build on the latest list, so two quick additions can't overwrite each other. */
  onChange: React.Dispatch<React.SetStateAction<DraftAttachment[]>>;
  packs: PackOption[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState(packs[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const full = value.length >= MAX_ATTACHMENTS;
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="divide-y divide-black/10 rounded-md border border-black/10">
          {value.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                📎 {a.fileName} <span className="text-xs text-black/50">{formatFileSize(a.sizeBytes)}</span>
                {a.pack && <span className="ml-1 rounded bg-dxv-yellow px-1.5 text-xs font-medium">Opportunities pack</span>}
              </span>
              <button
                type="button"
                className="text-xs text-dxv-green underline"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await removeDraftAttachment(a.id);
                    onChange((prev) => prev.filter((x) => x.id !== a.id));
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            aria-label="Attach a file"
            disabled={pending}
            className="max-w-64 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              run(async () => {
                const startRes = await startAttachmentUpload({ fileName: file.name, fileSize: file.size, current: value.map((a) => a.id) });
                if ("error" in startRes) throw new Error(startRes.error);
                await uploadFile(startRes.target, file, file.type || "application/octet-stream");
                const done = await confirmAttachmentUpload(startRes.id);
                if ("error" in done) throw new Error(done.error);
                onChange((prev) => [...prev, done]);
                if (fileRef.current) fileRef.current.value = "";
              });
            }}
          />
          {packs.length > 0 && (
            <span className="flex flex-wrap items-center gap-2">
              <select value={pack} onChange={(e) => setPack(e.target.value)} className={`${inputClass} w-auto`} aria-label="Approved opportunities pack">
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (Round {p.round})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !pack}
                className={buttonClass("secondary")}
                onClick={() =>
                  run(async () => {
                    const res = await attachOpportunityPack(
                      pack,
                      value.map((a) => a.id),
                    );
                    if ("error" in res) throw new Error(res.error);
                    onChange((prev) => [...prev, res]);
                  })
                }
              >
                Attach the pack (PDF)
              </button>
            </span>
          )}
          {pending && <Spinner />}
        </div>
      )}
      <p className="text-xs text-black/55">PDF, Word, Excel, PNG or JPEG; up to {MAX_ATTACHMENTS} files and 15 MB in total.</p>
      {error && (
        <p role="alert" className="rounded bg-dxv-yellow/30 px-2 py-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
