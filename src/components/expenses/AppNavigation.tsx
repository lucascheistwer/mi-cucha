"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [
  {
    href: "/dashboard",
    label: "Gastos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/resumen",
    label: "Resumen",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3v11a3 3 0 0 0 3 3h7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14 14 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 21V10a3 3 0 0 0-3-3H7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m10 10-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/viajes",
    label: "Viajes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="7" width="16" height="12" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 12h16" />
      </svg>
    ),
  },
  {
    href: "/configuracion",
    label: "Ajustes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.6A1.7 1.7 0 0 0 11.64 3.6V3.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.11a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function isItemActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/60 bg-[#fffaf3]/92 px-4 py-2.5 shadow-[0_10px_28px_rgba(28,25,23,0.06)] backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              Mi Cucha
            </span>
          </Link>
        </div>
      </header>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur"
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const isActive = isItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isActive ? "bg-teal-50 text-teal-700" : "text-stone-500"
                  }`}
                >
                  {item.icon}
                </span>
                <span className={isActive ? "text-teal-700" : "text-stone-500"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
