import { NoticeBlocks } from "@/components/notice-text";
import { PRIVACY_NOTICE_DATE, PRIVACY_NOTICE_VERSION, privacyNotice } from "@/content/privacy-notice";
import { PRIVACY_EMAIL } from "@/lib/legal-links";

export const metadata = {
  title: "Privacy notice · Diversity X Ventures",
  description: "How Diversity X Ventures uses personal data on its website and the DXV OS platform.",
};

// Public (no sign-in): DXV's privacy notice, as signed off by Kevin. Wording lives in
// src/content/privacy-notice.ts.
export default function PrivacyPage() {
  return (
    <main className="flex flex-1 justify-center bg-dxv-green px-4 py-10">
      <article className="w-full max-w-3xl space-y-8 rounded-xl bg-white p-6 text-[15px] leading-relaxed text-black/75 shadow-xl sm:p-10">
        <header className="space-y-2">
          <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
          <h1 className="text-2xl font-semibold text-dxv-green sm:text-3xl">Privacy notice</h1>
          <p className="text-sm text-black/60">
            For diversityxventures.com and the DXV OS platform: website visitors, founders who apply, and members. Last updated {PRIVACY_NOTICE_DATE}. Version{" "}
            {PRIVACY_NOTICE_VERSION}.
          </p>
        </header>
        {privacyNotice(PRIVACY_EMAIL).map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className="text-lg font-semibold text-dxv-green">{s.title}</h2>
            <NoticeBlocks blocks={s.blocks} />
          </section>
        ))}
      </article>
    </main>
  );
}
