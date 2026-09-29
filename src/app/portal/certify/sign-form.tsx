"use client";

// Choosing and signing an investor statement. The wording shown is the approved version
// the server sent; the server re-checks it's still the current one when signing.

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { Field, inputClass } from "@/components/ui";
import { declareRestricted, signStatement } from "../actions";

type Statement = { id: string; kind: string; title: string; body: string; criteria: string[] };

export function SignStatementForm({ statements, name }: { statements: Statement[]; name: string }) {
  const [choice, setChoice] = useState<string>("");
  const chosen = statements.find((s) => s.id === choice);
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Which statement applies to you?</legend>
        {statements.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green/[0.04]">
            <input type="radio" name="choice" value={s.id} checked={choice === s.id} onChange={() => setChoice(s.id)} className="mt-1" />
            <span>
              <strong>{s.kind === "HNW_STATEMENT" ? "High net worth individual" : "Self-certified sophisticated investor"}</strong>
              <span className="block text-xs text-black/55">
                {s.kind === "HNW_STATEMENT"
                  ? "Based on your income or net assets."
                  : "Based on your investing or professional experience (e.g. six months in an angel syndicate)."}
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm has-[:checked]:border-dxv-green">
          <input type="radio" name="choice" value="none" checked={choice === "none"} onChange={() => setChoice("none")} className="mt-1" />
          <span>
            <strong>Neither applies to me</strong>
            <span className="block text-xs text-black/55">You can still be part of the DXV community, but we can&apos;t share investment opportunities with you.</span>
          </span>
        </label>
      </fieldset>

      {chosen && (
        <ActionForm action={signStatement} resetOnSuccess={false} className="space-y-4 rounded-lg border border-dxv-green/30 bg-white p-4">
          <input type="hidden" name="textId" value={chosen.id} />
          <h2 className="font-semibold text-dxv-green">{chosen.title}</h2>
          {chosen.body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line text-sm text-black/80">
              {p}
            </p>
          ))}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tick the criteria that apply to you (at least one)</legend>
            {chosen.criteria.map((c) => (
              <label key={c} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="criterion" value={c} className="mt-1" />
                <span>{c}</span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" required className="mt-1" />
            <span>I confirm this statement is true, and that I have read and understood it.</span>
          </label>
          <Field label="Sign by typing your full name" hint={`Signed today, ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}>
            <input name="signatureName" required placeholder={name} autoComplete="name" className={inputClass} />
          </Field>
          <SubmitButton pendingLabel="Signing…" doneLabel="Signed">
            Sign statement
          </SubmitButton>
        </ActionForm>
      )}

      {choice === "none" && (
        <div className="space-y-2 rounded-lg border border-black/15 bg-white p-4 text-sm">
          <p>
            Thanks for letting us know. Under UK financial promotion rules, DXV can only share investment opportunities with people who hold a current high
            net worth or sophisticated investor statement. You&apos;ll still be welcome at DXV events, and you can sign a statement here at any time if your
            circumstances change.
          </p>
          <ActionButton run={declareRestricted} variant="secondary" pendingLabel="Saving…">
            Continue without a statement
          </ActionButton>
        </div>
      )}
    </div>
  );
}
