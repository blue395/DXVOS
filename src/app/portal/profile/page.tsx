import { ActionForm, SubmitButton } from "@/components/action-form";
import { OnboardingStepper } from "@/components/portal/stepper";
import { Field, inputClass } from "@/components/ui";
import { requireAngel } from "@/lib/auth";
import { ANGEL_TAG_SUGGESTIONS, EXPERIENCE_LEVELS, SECTOR_SUGGESTIONS, TICKET_RANGES } from "@/lib/pipeline";
import { updateMyProfile } from "../actions";

export const metadata = { title: "Your details · DXV Members" };

export default async function ProfilePage() {
  const { angel } = await requireAngel();
  const onboarding = !angel.profileConfirmedAt;
  // Someone DXV already knows: "is this you?"; someone new: questions.
  const known = !!(angel.phone || angel.location || angel.sectors.length || angel.source);
  const otherSectors = angel.sectors.filter((s) => !SECTOR_SUGGESTIONS.some((x) => x.toLowerCase() === s.toLowerCase()));
  const otherTags = angel.tags.filter((t) => !ANGEL_TAG_SUGGESTIONS.some((x) => x.toLowerCase() === t.toLowerCase()));
  const has = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

  return (
    <div className="space-y-4">
      {onboarding && <OnboardingStepper current="profile" />}
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">{onboarding ? (known ? "Is this you? Check your details" : "Tell us about yourself") : "Your details"}</h1>
        <p className="text-sm text-black/60">
          {onboarding && known
            ? "This is what DXV has on record for you. Correct anything that's out of date and fill in the gaps."
            : "This helps us share the right opportunities with you. Only the DXV team sees your details."}
        </p>
      </div>
      <ActionForm action={updateMyProfile} resetOnSuccess={false} className="space-y-5 rounded-lg border border-black/10 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input name="name" required defaultValue={angel.name} autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Email" hint="Your login. To change it, contact the DXV team.">
            <input value={angel.email ?? ""} readOnly className={`${inputClass} bg-black/[0.03]`} />
          </Field>
          <Field label="Mobile">
            <input name="phone" defaultValue={angel.phone ?? ""} autoComplete="tel" className={inputClass} />
          </Field>
          <Field label="Where are you based?">
            <input name="location" defaultValue={angel.location ?? ""} placeholder="e.g. London" className={inputClass} />
          </Field>
          <Field label="LinkedIn (optional)">
            <input name="linkedinUrl" type="url" defaultValue={angel.linkedinUrl ?? ""} placeholder="https://www.linkedin.com/in/…" className={inputClass} />
          </Field>
          {!angel.source && (
            <Field label="How did you hear about DXV?">
              <input name="source" placeholder="e.g. a friend, an event, LinkedIn" className={inputClass} />
            </Field>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-black/70">Which sectors interest you?</legend>
          <div className="flex flex-wrap gap-2">
            {SECTOR_SUGGESTIONS.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dxv-green/25 px-3 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-green has-[:checked]:text-white">
                <input type="checkbox" name="sector" value={s} defaultChecked={has(angel.sectors, s)} className="sr-only" />
                {s}
              </label>
            ))}
          </div>
          <input name="otherSectors" defaultValue={otherSectors.join(", ")} placeholder="Other sectors (comma-separated)" className={inputClass} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your typical cheque size">
            <select name="ticketRange" defaultValue={angel.ticketRange ?? ""} className={inputClass}>
              <option value="">Prefer not to say</option>
              {TICKET_RANGES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Your angel investing experience">
            <select name="experience" defaultValue={angel.experience ?? ""} className={inputClass}>
              <option value="">Prefer not to say</option>
              {EXPERIENCE_LEVELS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="A line or two about you (optional)">
          <textarea name="bio" rows={3} defaultValue={angel.bio ?? ""} placeholder="Your background, and what you can bring to founders" className={inputClass} />
        </Field>

        <fieldset className="space-y-2 rounded-md bg-dxv-green/[0.03] p-3">
          <legend className="px-1 text-xs font-medium text-black/70">About you (optional)</legend>
          <p className="text-xs text-black/55">
            Entirely optional. DXV champions diversity in who invests as well as who gets funded; if you&apos;re happy to share, this helps us understand
            our community. Only the DXV team sees it, and you can remove it at any time.
          </p>
          <div className="flex flex-wrap gap-2">
            {ANGEL_TAG_SUGGESTIONS.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1 text-sm has-[:checked]:border-dxv-green has-[:checked]:bg-dxv-yellow/60">
                <input type="checkbox" name="tag" value={t} defaultChecked={has(angel.tags, t)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
          <input name="otherTags" defaultValue={otherTags.join(", ")} placeholder="Anything else you'd like to share (comma-separated)" className={inputClass} />
        </fieldset>

        <SubmitButton pendingLabel="Saving…">{onboarding ? "Save and continue" : "Save"}</SubmitButton>
      </ActionForm>
    </div>
  );
}
