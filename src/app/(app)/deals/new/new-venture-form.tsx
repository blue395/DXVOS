"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { DeckUploader, type DeckResult } from "@/components/deck-uploader";
import { EXTRACTED_FIELD_KEYS } from "@/lib/deck-ai/schema";
import { createVenture } from "../actions";
import { VentureFields } from "../venture-fields";

export function NewVentureForm() {
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const extracted = deck?.extracted ?? null;
  const aiFields = extracted ? EXTRACTED_FIELD_KEYS.filter((k) => extracted[k] !== null && extracted[k] !== "") : [];

  return (
    <div className="space-y-4">
      <Card title="Start from the pitch deck (optional)">
        <DeckUploader onComplete={setDeck} />
        <p className="mt-2 text-xs text-black/50">
          The AI suggests the details below and drafts the eligibility screen, which you&apos;ll review on the deal page.
          A private copy of the deck is kept for re-running the screen.
        </p>
      </Card>

      <Card>
        {/* key: re-mount the inputs so AI suggestions become their starting values */}
        <ActionForm key={deck?.analysisId ?? "blank"} action={createVenture} className="space-y-4" resetOnSuccess={false}>
          {deck && (
            <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
              Fields tagged <strong>AI suggested</strong> were read from the deck. Check and correct each one before creating
              the venture. Nothing is saved until you click Create.
            </p>
          )}
          <p className="text-sm text-black/60">
            New ventures start at <strong>Founder deck</strong>.
          </p>
          <input type="hidden" name="analysisId" value={deck?.analysisId ?? ""} />
          <VentureFields v={extracted ?? {}} ai={aiFields} />
          <SubmitButton>Create venture</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
