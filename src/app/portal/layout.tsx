import Link from "next/link";
import { requireAngel } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { SignOutButton } from "@/components/sign-out-button";

// The angel portal's shell: no team navigation, no DXV Brain, no job tray. Pages and
// actions still check requireAngel() themselves.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { angel } = await requireAngel();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-dxv-green text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2">
            <span className="rounded bg-dxv-yellow px-1.5 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</span>
            <span className="font-semibold">Members</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 text-sm">
            {angel.onboardedAt && (
              <>
                <Link href="/portal" className="rounded px-2.5 py-1.5 hover:bg-white/10">
                  Home
                </Link>
                <Link href="/portal/profile" className="rounded px-2.5 py-1.5 hover:bg-white/10">
                  My profile
                </Link>
              </>
            )}
          </nav>
          <span className="hidden text-sm text-white/70 sm:inline">{angel.name}</span>
          <SignOutButton action={logout} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
