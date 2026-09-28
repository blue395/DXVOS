"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, disabled }: { href: string; children: React.ReactNode; disabled?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (disabled) {
    return (
      <span title="Coming in week 2+" className="cursor-not-allowed rounded px-3 py-1.5 text-white/35">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1.5 ${active ? "bg-dxv-yellow font-medium text-dxv-green" : "text-white/85 hover:bg-white/10"}`}
    >
      {children}
    </Link>
  );
}
