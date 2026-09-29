"use client";

// Client pieces of the angel page: recording a signed statement (with an optional file,
// uploaded straight to storage first), and archive / unlink buttons.

import { useRef } from "react";
import type { CertificationType } from "@/generated/prisma/enums";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { Field, inputClass } from "@/components/ui";
import { ACCEPT_ATTRIBUTE, checkUpload } from "@/lib/documents";
import { uploadFile } from "@/lib/deck-upload-client";
import { CERTIFICATION_LABELS, CERTIFICATION_VALID_MONTHS } from "@/lib/pipeline";
import type { ActionResult } from "@/lib/action-result";
import { recordCertification, removeAngelAlias, setAngelArchived, startCertificationUpload } from "../actions";

export function CertificationForm({ angelId }: { angelId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const file = fileRef.current?.files?.[0];
    formData.delete("file");
    if (file) {
      const check = checkUpload(file.name, file.size);
      if ("error" in check) return { error: check.error };
      const start = await startCertificationUpload({ angelId, fileName: file.name, fileSize: file.size });
      if ("error" in start) return { error: start.error };
      try {
        await uploadFile(start.target, file, start.mimeType);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Upload failed." };
      }
      formData.set("storagePath", start.storagePath);
      formData.set("fileName", file.name);
      formData.set("sizeBytes", String(file.size));
    }
    return recordCertification(angelId, prev, formData);
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Statement">
          <select name="type" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {(Object.keys(CERTIFICATION_LABELS) as CertificationType[]).map((t) => (
              <option key={t} value={t}>
                {CERTIFICATION_LABELS[t]} ({CERTIFICATION_VALID_MONTHS[t]} months)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Signed on">
          <input name="signedOn" type="date" required max={today} className={inputClass} />
        </Field>
        <Field label="Signed statement (optional)" hint="PDF, Word or a scan saved as PDF, up to 50 MB">
          <input ref={fileRef} name="file" type="file" accept={ACCEPT_ATTRIBUTE} className="block w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-dxv-green/10 file:px-2 file:py-1 file:text-dxv-green" />
        </Field>
        <Field label="Note (optional)">
          <input name="note" placeholder="e.g. Received by email" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Recording…" doneLabel="Recorded">
        Record statement
      </SubmitButton>
    </ActionForm>
  );
}

export function ArchiveAngelButton({ angelId, archived }: { angelId: string; archived: boolean }) {
  return (
    <ActionButton
      run={() => setAngelArchived(angelId, !archived)}
      variant="secondary"
      pendingLabel={archived ? "Restoring…" : "Archiving…"}
      confirm={archived ? undefined : "Archive this angel? They're hidden from the list (nothing is deleted) and can be restored."}
    >
      {archived ? "Restore" : "Archive"}
    </ActionButton>
  );
}

export function UnlinkAliasButton({ aliasId }: { aliasId: string }) {
  return (
    <ActionButton run={() => removeAngelAlias(aliasId)} variant="secondary" pendingLabel="Unlinking…" confirm="Unlink this name from the angel?">
      Unlink
    </ActionButton>
  );
}
