// Pieces shared by the diversity consent step and Profile > My diversity information.
// Server-component safe. Wording: diversity-consent-v1 (consent-v1.ts), verbatim.
import { CONSENT_V1 } from "@/lib/diversity/consent-v1";

export function ConsentIntro() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-dxv-green">{CONSENT_V1.heading}</h1>
      {CONSENT_V1.intro.map((p) => (
        <p key={p} className="text-sm text-black/70">
          {p}
        </p>
      ))}
      <p className="text-sm text-black/70">
        <strong>{CONSENT_V1.howWeUseLabel}</strong> {CONSENT_V1.howWeUse}
      </p>
    </div>
  );
}

export function CarriedOverNote({ expires }: { expires: Date | null }) {
  return (
    <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-sm">
      We&apos;ve filled in what you told us on your old profile. It isn&apos;t used for anything until you tick the consent box for it and save, and
      we&apos;ll delete it {expires ? `on ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(expires)}` : "soon"} if you don&apos;t.
      Change or clear anything you like.
    </p>
  );
}
