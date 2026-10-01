import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/login/actions";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { MenuDivider, MobileMenu } from "@/components/mobile-menu";
import { NavProgress } from "@/components/nav-progress";
import { JobTray } from "@/components/job-tray";
import { BrainPanel } from "@/components/brain/brain-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { StaleVersionBanner } from "@/components/stale-version-banner";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/deals", label: "Deals" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/angels", label: "Angels" },
  { href: "/playbook", label: "Playbook" },
  { href: "/activity", label: "Activity" },
];

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
      <header className="relative bg-dxv-green text-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="rounded bg-dxv-yellow px-1.5 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</span>
            <span className="font-semibold">OS</span>
          </Link>
          {/* Wide screens: the full menu in the bar. */}
          <nav className="hidden flex-1 items-center gap-1 text-sm lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} badge={n.href === "/playbook" ? suggestedLessons : undefined}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm lg:ml-0">
            {/* Every team member: their own member (angel) view; set up on first use. */}
            <Link
              href={user.angelId ? "/portal" : "/member-access"}
              className="rounded bg-dxv-yellow px-2 py-1 font-medium whitespace-nowrap text-dxv-green transition hover:bg-white"
              title="See DXV as an angel: your own member portal"
            >
              Member portal
            </Link>
            <span className="hidden items-center gap-3 lg:flex">
              <Link href="/team" className="rounded px-2 py-1 text-white/80 transition hover:bg-white/10 hover:text-white" title="Team logins">
                Team
              </Link>
              <Link href="/account" className="rounded px-2 py-1 text-white/70 transition hover:bg-white/10 hover:text-white" title="Your account and sign-in methods">
                {user.name}
              </Link>
              <SignOutButton action={logout} />
            </span>
            {/* Phones and tablets: everything else behind the burger. */}
            <MobileMenu className="lg:hidden">
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href} menu badge={n.href === "/playbook" ? suggestedLessons : undefined}>
                  {n.label}
                </NavLink>
              ))}
              <MenuDivider />
              <NavLink href="/team" menu>
                Team
              </NavLink>
              <NavLink href="/account" menu>
                Your account <span className="text-sm text-white/60">· {user.name}</span>
              </NavLink>
              <div className="px-1 pt-1 text-base">
                <SignOutButton action={logout} />
              </div>
            </MobileMenu>
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
