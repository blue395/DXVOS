import Link from "next/link";
import { logout } from "@/app/login/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLink } from "@/components/nav-link";
import { MenuDivider, MobileMenu } from "@/components/mobile-menu";
import type { PortalLink } from "@/lib/portal-nav";

/**
 * The member portal's green header (portal pages and the learning pages around the course).
 * The course page itself is plain HTML and gets the same bar from portalRibbonHtml().
 */
export function PortalHeader({ name, partner, links }: { name: string; partner: boolean; links: PortalLink[] }) {
  return (
    <header className="relative bg-dxv-green text-white">
      {/* Wider than the page column so the whole menu fits in one line; burger below laptop width. */}
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/portal" className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-dxv-yellow px-1.5 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</span>
          <span className="font-semibold">Members</span>
        </Link>
        {/* Wider screens: the menu in the bar. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 text-sm lg:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact} fullPage={l.fullPage}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3 text-sm lg:ml-0">
          {partner && (
            <Link
              href="/"
              className="rounded bg-dxv-yellow px-2 py-1 font-medium whitespace-nowrap text-dxv-green transition hover:bg-white"
              title="Back to DXV OS"
            >
              Partner View
            </Link>
          )}
          <span className="hidden items-center gap-3 lg:flex">
            <span className="hidden whitespace-nowrap text-white/70 xl:inline">{name}</span>
            <SignOutButton action={logout} />
          </span>
          {/* Phones: the menu behind the burger. */}
          <MobileMenu className="lg:hidden">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.exact} fullPage={l.fullPage} menu>
                {l.label}
              </NavLink>
            ))}
            {links.length > 0 && <MenuDivider />}
            <p className="px-3 py-1 text-sm text-white/60">Signed in as {name}</p>
            <div className="px-1 text-base">
              <SignOutButton action={logout} />
            </div>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
