"use client";

// The founder application: details + PDF deck. Three steps on submit: check the details
// (and get a private upload slot), upload the deck straight to storage, then file it.

import { useState } from "react";
import { Spinner, buttonClass, inputClass } from "@/components/ui";
import { COMPANY_STAGES } from "@/lib/founder-intake";
import { deckFileProblem, uploadDeckFile } from "@/lib/deck-upload-client";
import { actionErrorMessage } from "@/lib/stale-version";
import { completeFounderSubmission, startFounderSubmission } from "./actions";

const HEARD_FROM = ["DXV website", "LinkedIn", "An event", "A founder recommended DXV", "An angel recommended DXV", "An accelerator or programme", "Other"];

type Step = "idle" | "checking" | "uploading" | "filing" | "done";
const STEP_LABEL: Record<Step, string> = { idle: "", checking: "Checking your details…", uploading: "Uploading your deck…", filing: "Filing your application…", done: "" };

export function ApplyForm({ formToken, diversityOptions }: { formToken: string; diversityOptions: string[] }) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const busy = step !== "idle" && step !== "done";

  if (step === "done") {
    return (
      <div role="status" className="space-y-3 rounded-lg bg-dxv-green/[0.06] p-5">
        <p className="text-lg font-semibold text-dxv-green">Thank you: we&apos;ve received {company || "your application"}.</p>
        <p className="text-black/70">
          We&apos;ve sent a confirmation to your email. The team reviews every application against our criteria, and we&apos;ll be in touch with an
          update.
        </p>
      </div>
    );
  }

  async function submit(form: HTMLFormElement) {
    setError(null);
    const f = new FormData(form);
    const file = f.get("deck");
    if (!(file instanceof File) || file.size === 0) return setError("Add your deck (PDF).");
    const problem = deckFileProblem(file);
    if (problem) return setError(problem);
    const diversityConsent = f.get("diversityConsent") === "on";
    const input = {
      companyName: String(f.get("companyName") ?? ""),
      founderNames: String(f.get("founderNames") ?? ""),
      email: String(f.get("email") ?? ""),
      pitch: String(f.get("pitch") ?? ""),
      sector: String(f.get("sector") ?? ""),
      companyStage: String(f.get("companyStage") ?? "") as (typeof COMPANY_STAGES)[number],
      raiseAmountGbp: String(f.get("raiseAmountGbp") ?? "").replace(/[£,\s]/g, ""),
      website: String(f.get("website") ?? ""),
      linkedinUrl: String(f.get("linkedinUrl") ?? ""),
      heardFrom: String(f.get("heardFrom") ?? ""),
      diversityThemes: diversityConsent ? f.getAll("diversity").map(String) : [],
      privacyConsent: f.get("privacyConsent") === "on",
      diversityConsent,
      fileName: file.name,
      fileSize: file.size,
      formToken,
      trap: String(f.get("company_url") ?? ""),
    };
    try {
      setStep("checking");
      const started = await startFounderSubmission(input);
      if ("error" in started) {
        setStep("idle");
        return setError(started.error);
      }
      setStep("uploading");
      await uploadDeckFile(started.target, file);
      setStep("filing");
      const done = await completeFounderSubmission(started.submissionId, started.completionToken);
      if ("error" in done) {
        setStep("idle");
        return setError(done.error);
      }
      setCompany(input.companyName.trim());
      setStep("done");
    } catch (e) {
      setStep("idle");
      setError(e instanceof Error && e.message.startsWith("Upload failed") ? "Your deck didn't upload. Please check your connection and try again." : actionErrorMessage(e));
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company URL
          <input name="company_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-dxv-green">Your company</legend>
        <Field label="Company name" required>
          <input name="companyName" required maxLength={120} autoComplete="organization" className={inputClass} />
        </Field>
        <Field label="Founder name(s)" required>
          <input name="founderNames" required maxLength={200} placeholder="e.g. Amara Okafor, Priya Shah" className={inputClass} />
        </Field>
        <Field label="Email" required hint="We'll reply here.">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Website">
          <input name="website" type="url" placeholder="https://" className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What does the company do, in one line?" required>
            <input name="pitch" required minLength={10} maxLength={200} placeholder="e.g. Repeat-prescription software for independent UK pharmacies" className={inputClass} />
          </Field>
        </div>
        <Field label="Sector" required>
          <input name="sector" required maxLength={80} placeholder="e.g. Healthtech" className={inputClass} />
        </Field>
        <Field label="Stage" required>
          <select name="companyStage" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {COMPANY_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="How much are you raising? (£)" required>
          <input name="raiseAmountGbp" required inputMode="numeric" placeholder="e.g. 250,000" className={inputClass} />
        </Field>
        <Field label="LinkedIn (founder or company)">
          <input name="linkedinUrl" type="url" placeholder="https://www.linkedin.com/…" className={inputClass} />
        </Field>
        <Field label="How did you hear about DXV?">
          <select name="heardFrom" defaultValue="" className={inputClass}>
            <option value="">Choose…</option>
            {HEARD_FROM.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">Your deck</legend>
        <input
          name="deck"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="block w-full rounded-md border border-dashed border-dxv-green/40 bg-dxv-green/[0.03] p-4 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-dxv-green file:px-3 file:py-1.5 file:text-white"
        />
        <p className="text-xs text-black/55">PDF, up to 20 MB.</p>
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border border-black/10 p-4" disabled={busy}>
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-dxv-green">Founder diversity (optional)</legend>
        <p className="text-sm text-black/65">
          DXV exists to back Underestimated Founders, so we track the diversity of the founders we see and back. Tick any that describe your founding
          team, only if you&apos;re happy to share. It never affects how we assess your application.
        </p>
        <div className="flex flex-wrap gap-2">
          {diversityOptions.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dxv-green/25 px-3 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green has-[:checked]:text-white">
              <input type="checkbox" name="diversity" value={t} className="sr-only" />
              {t}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="diversityConsent" className="mt-1 accent-dxv-green" />
          <span>I consent to DXV recording the founder diversity information I&apos;ve ticked, to track who we see and back. I can ask for it to be removed at any time.</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3" disabled={busy}>
        <p className="text-xs text-black/60">
          How we use your details: DXV uses the information and deck you share to assess your application, to keep in touch about it, and to learn
          from our dealflow. Your deck is shared only with the DXV team and, if your company progresses, with DXV&apos;s certified angel members. We
          keep applications on file, and you can ask us to update or delete your details by emailing angels@diversityx.vc.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="privacyConsent" required className="mt-1 accent-dxv-green" />
          <span>I agree to DXV using my details as described above. *</span>
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} aria-busy={busy} className={`${buttonClass()} w-full justify-center py-3 text-base sm:w-auto`}>
        {busy ? (
          <>
            <Spinner /> {STEP_LABEL[step]}
          </>
        ) : (
          "Submit my application"
        )}
      </button>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-black/80">
        {label}
        {required && <span className="text-black/45"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-black/50">{hint}</span>}
    </label>
  );
}
