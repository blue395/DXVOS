// The footer on every page (docs/privacy, "Other in-app copy"): privacy notice, terms and the
// privacy contact, and the cookie note (only essential cookies: the sign-in one).
// Links are placeholders until the notice is published (src/lib/legal-links.ts).
import { PRIVACY_EMAIL, PRIVACY_NOTICE_URL, TERMS_URL } from "@/lib/legal-links";

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-black/10 bg-white px-4 py-4 text-center text-xs text-black/55 print:hidden">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <a href={PRIVACY_NOTICE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-dxv-green hover:underline">
          Privacy notice
        </a>
        <span aria-hidden>·</span>
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-dxv-green hover:underline">
          Terms
        </a>
        <span aria-hidden>·</span>
        <a href={`mailto:${PRIVACY_EMAIL}`} className="hover:text-dxv-green hover:underline">
          Contact {PRIVACY_EMAIL}
        </a>
      </p>
      <p className="mt-1">We use only the cookies needed to keep you signed in. No tracking.</p>
    </footer>
  );
}
