"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, disabled, badge }: { href: string; children: React.ReactNode; disabled?: boolean; badge?: number }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (disabled) {
    return (
      <span title="Coming in week 2+" className="hidden cursor-not-allowed rounded px-3 py-1.5 text-white/35 sm:inline">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`shrink-0 rounded px-3 py-1.5 transition ${active ? "bg-dxv-yellow font-medium text-dxv-green" : "text-white/85 hover:bg-white/10"}`}
    >
      {children}
      {badge ? (
        <span className="ml-1.5 rounded-full bg-dxv-yellow px-1.5 text-xs font-semibold text-dxv-green" title={`${badge} waiting for review`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
