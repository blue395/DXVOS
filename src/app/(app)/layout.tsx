import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/login/actions";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { NavProgress } from "@/components/nav-progress";
import { JobTray } from "@/components/job-tray";
import { BrainPanel } from "@/components/brain/brain-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { StaleVersionBanner } from "@/components/stale-version-banner";

// Shell for every signed-in page. requireAdmin() here protects page *rendering*;
// server actions still check again themselves.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // (the count only renders once requireAdmin has passed)
  const [user, suggestedLessons] = await Promise.all([requireAdmin(), db.lesson.count({ where: { status: "SUGGESTED" } })]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <header className="bg-dxv-green text-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="rounded bg-dxv-yellow px-1.5 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</span>
            <span className="font-semibold">OS</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/deals">Deals</NavLink>
            <NavLink href="/portfolio" disabled>
              Portfolio
            </NavLink>
            <NavLink href="/playbook" badge={suggestedLessons}>
              Playbook
            </NavLink>
            <NavLink href="/activity">Activity</NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{user.name}</span>
            <SignOutButton action={logout} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>
      <JobTray />
      <BrainPanel />
      <StaleVersionBanner />
    </div>
  );
}
