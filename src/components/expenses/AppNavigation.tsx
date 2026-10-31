"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabIconClass = "h-6 w-6";

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={tabIconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NAV_ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [
  {
    href: "/dashboard",
    label: "Gastos",
    icon: (
      <TabIcon>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 17.5v-11" />
      </TabIcon>
    ),
  },
  {
    href: "/resumen",
    label: "Resumen",
    icon: (
      <TabIcon>
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="M7 21h10" />
        <path d="M12 3v18" />
        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
      </TabIcon>
    ),
  },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    icon: (
      <TabIcon>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </TabIcon>
    ),
  },
  {
    href: "/viajes",
    label: "Viajes",
    icon: (
      <TabIcon>
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </TabIcon>
    ),
  },
];

function isItemActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/configuracion");

  return (
    <>
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/60 bg-[#fffaf3]/92 px-4 py-2.5 shadow-[0_10px_28px_rgba(28,25,23,0.06)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              Mi Cucha
            </span>
          </Link>

          <Link
            href="/configuracion"
            aria-label="Ajustes"
            aria-current={settingsActive ? "page" : undefined}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
              settingsActive ? "text-teal-700" : "text-stone-500 hover:bg-white/80 hover:text-stone-800"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </header>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur"
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const isActive = isItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-xs font-medium tracking-tight"
              >
                <span className={isActive ? "text-teal-700" : "text-stone-500"}>{item.icon}</span>
                <span
                  className={`h-1 w-5 rounded-full ${isActive ? "bg-teal-600" : "bg-transparent"}`}
                  aria-hidden="true"
                />
                <span className={isActive ? "text-teal-700" : "text-stone-500"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
