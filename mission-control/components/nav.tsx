"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Inbox, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Vandaag", icon: Inbox },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/leads", label: "Leads", icon: Users },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Mobiel: onderbalk */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-md">
          {TABS.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-medium ${active(href) ? "text-ink" : "text-muted"}`}
              >
                <Icon size={22} strokeWidth={1.5} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop: smalle zijbalk */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center gap-2 border-r border-line bg-bg pt-6 md:flex">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[12px] text-[12px] font-medium ${active(href) ? "bg-surface text-ink" : "text-muted"}`}
          >
            <Icon size={22} strokeWidth={1.5} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
