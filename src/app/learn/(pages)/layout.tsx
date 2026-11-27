// The Angel Foundations course pages around the course itself (sign-up, welcome, account,
// privacy). The course uses DXV's six brand colours (Blue, 2026-11-27: course pages only):
// green #1a3c35, yellow #fbe45b, purple #5c3d68, red #971914, orange #f3af4c, grey #c4bac2.
// Light and dark follow the visitor's setting.
import Link from "next/link";
import { COURSE_DISCLAIMER, COURSE_NAME } from "@/content/course";

export const metadata = { title: `${COURSE_NAME} · Diversity X Ventures`, robots: { index: true, follow: true } };

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <div className="flex flex-1 flex-col bg-[#f4f6f3] text-[#15302a] dark:bg-[#0c1d19] dark:text-[#e7efea]">
      <header className="border-b-[6px] border-[#fbe45b] bg-[#1a3c35]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          {/* A plain link: the course is a whole page of its own (full page load). */}
          <a href="/learn" className="flex items-center gap-2 font-semibold text-[#fbe45b]">
            <span className="rounded bg-[#fbe45b] px-2 py-0.5 text-xs font-bold tracking-widest text-[#1a3c35]">DXV</span>
            {COURSE_NAME}
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-[#c4bac2]/60 dark:border-[#274540]">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 text-sm text-[#52665f] dark:text-[#a3b6af]">
          <p>{COURSE_DISCLAIMER}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/learn/privacy" className="underline">
              Course privacy notice
            </Link>
            <a href="https://www.diversityxventures.com" className="underline" target="_blank" rel="noopener">
              diversityxventures.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
