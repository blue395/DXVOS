"use client";

import { useTransition } from "react";
import { Spinner } from "@/components/ui";
import { archiveDocument } from "../document-actions";
import { actionErrorMessage } from "@/lib/stale-version";

export function ArchiveDocumentButton({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Hide this file from the deal (it's kept, not deleted)"
      className="inline-flex cursor-pointer items-center gap-1 rounded px-1 text-xs text-black/40 transition hover:bg-black/5 hover:text-black disabled:cursor-wait disabled:opacity-60"
      onClick={() => {
        if (!window.confirm(`Archive ${fileName}? It will be hidden from this deal but kept in storage.`)) return;
        start(async () => {
          try {
            const res = await archiveDocument(documentId);
            if (res.error) window.alert(res.error);
          } catch (e) {
            window.alert(actionErrorMessage(e));
          }
        });
      }}
    >
      {pending && <Spinner className="h-3 w-3" />}
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
