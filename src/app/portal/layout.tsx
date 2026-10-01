import Link from "next/link";
import { requireAngel } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLink } from "@/components/nav-link";
import { MenuDivider, MobileMenu } from "@/components/mobile-menu";

// The angel portal's shell: no team navigation, no DXV Brain, no job tray (partners, who are
// also angels, get a "Team app" link back). Pages and actions still check requireAngel()
// themselves.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user, angel } = await requireAngel();
  // The menu appears once onboarding is done (until then the steps lead the way).
  const links = angel.onboardedAt
    ? [
        { href: "/portal", label: "Home", exact: true },
        { href: "/portal/deals", label: "Deals" },
        { href: "/portal/portfolio", label: "My portfolio" },
        { href: "/portal/profile", label: "My profile" },
      ]
    : [];
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <header className="relative bg-dxv-green text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link href="/portal" className="flex shrink-0 items-center gap-2">
            <span className="rounded bg-dxv-yellow px-1.5 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</span>
            <span className="font-semibold">Members</span>
          </Link>
          {/* Wider screens: the menu in the bar. */}
          <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.exact}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm md:ml-0">
            {user.role === "ADMIN" && (
              <Link href="/" className="rounded bg-dxv-yellow px-2 py-1 font-medium whitespace-nowrap text-dxv-green transition hover:bg-white" title="Back to DXV OS">
                Team app
              </Link>
            )}
            <span className="hidden items-center gap-3 md:flex">
              <span className="text-white/70">{angel.name}</span>
              <SignOutButton action={logout} />
            </span>
            {/* Phones: the menu behind the burger. */}
            <MobileMenu className="md:hidden">
              {links.map((l) => (
                <NavLink key={l.href} href={l.href} exact={l.exact} menu>
                  {l.label}
                </NavLink>
              ))}
              {links.length > 0 && <MenuDivider />}
              <p className="px-3 py-1 text-sm text-white/60">Signed in as {angel.name}</p>
              <div className="px-1 text-base">
                <SignOutButton action={logout} />
              </div>
            </MobileMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
