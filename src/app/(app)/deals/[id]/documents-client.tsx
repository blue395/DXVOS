"use client";

import { useTransition } from "react";
import { archiveDocument } from "../document-actions";

export function ArchiveDocumentButton({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Hide this file from the deal (it's kept, not deleted)"
      className="text-xs text-black/40 hover:text-black disabled:opacity-50"
      onClick={() => {
        if (!window.confirm(`Archive ${fileName}? It will be hidden from this deal but kept in storage.`)) return;
        start(async () => {
          const res = await archiveDocument(documentId);
          if (res.error) window.alert(res.error);
        });
      }}
    >
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
