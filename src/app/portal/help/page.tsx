import { requireAngel } from "@/lib/auth";
import { trackPortalView } from "@/lib/portal-analytics";
import { FAQ } from "@/content/member-help";
import { HowThisWorks } from "@/components/portal/member-deal-parts";
import { PRIVACY_EMAIL } from "@/lib/legal-links";

export const metadata = { title: "Help · DXV Members" };

// Help and FAQs for members. The wording lives in src/content/member-help.ts.
export default async function HelpPage() {
  const who = await requireAngel();
  await trackPortalView(who, "OTHER");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-dxv-green">Help and FAQs</h1>
        <p className="text-sm text-black/60">How DXV rounds work, voting, S/EIS tax relief and how to reach the team.</p>
      </div>

      <HowThisWorks open />

      {FAQ.map((section) => (
        <section key={section.title} className="rounded-lg border border-black/10 bg-white">
          <h2 className="border-b border-black/10 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-dxv-green">{section.title}</h2>
          <div className="divide-y divide-black/10">
            {section.items.map((item) => (
              <details key={item.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span aria-hidden className="text-black/40 transition group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-2 space-y-2 text-sm text-black/75">
                  {item.a.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section id="contact" className="rounded-lg border-2 border-dxv-green bg-white p-4 text-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dxv-green">Contact the team</h2>
        <p className="mt-1 text-black/75">
          Questions about a deal, your investments or your account? Email{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-dxv-green underline">
            {PRIVACY_EMAIL}
          </a>{" "}
          and the DXV team will get back to you.
        </p>
        <p className="mt-2 text-xs text-black/55">
          DXV doesn&apos;t give investment, tax or legal advice. Investing in early-stage companies is high risk: you could lose all the money you invest.
        </p>
      </section>
    </div>
  );
}
