import Link from "next/link";
import { requireAngel } from "@/lib/auth";
import { PORTAL_LINKS } from "@/lib/portal-nav";
import { PortalHeader } from "@/components/portal-header";

// The angel portal's shell: no team navigation, no DXV Brain, no job tray (partners, who are
// also angels, get a "Partner View" link back). Pages and actions still check requireAngel()
// themselves.
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user, angel } = await requireAngel();
  // The menu appears once onboarding is done (until then the steps lead the way).
  const links = angel.onboardedAt ? PORTAL_LINKS : [];
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <PortalHeader name={angel.name} partner={user.role === "ADMIN"} links={links} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      <p className="mx-auto w-full max-w-4xl px-4 pb-2 text-sm text-black/60">
        Questions?{" "}
        <Link href="/portal/help" className="font-medium text-dxv-green underline">
          Help and FAQs
        </Link>
      </p>
    </div>
  );
}
