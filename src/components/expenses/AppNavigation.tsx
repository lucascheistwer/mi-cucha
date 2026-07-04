"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Gastos",
    description: "Cargar y editar",
  },
  {
    href: "/resumen",
    label: "Resumen",
    description: "Balance del mes",
  },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    description: "Comparar meses",
  },
  {
    href: "/configuracion",
    label: "Ajustes",
    description: "Cucha y categorías",
  },
];

function getCurrentItem(pathname: string) {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
}

export function AppNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const currentItem = getCurrentItem(pathname);

  return (
    <header className="sticky top-0 z-20 -mx-4 border-b border-white/60 bg-[#fffaf3]/92 px-4 py-3 shadow-[0_12px_36px_rgba(28,25,23,0.08)] backdrop-blur">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="min-w-0" onClick={() => setIsOpen(false)}>
            <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              Mi Cucha
            </span>
            <span className="block truncate text-lg font-semibold tracking-tight text-stone-950">
              {currentItem.label}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 shadow-[0_10px_24px_rgba(28,25,23,0.08)] transition hover:border-stone-400 hover:text-stone-950"
            aria-expanded={isOpen}
            aria-controls="app-navigation-menu"
            aria-label={isOpen ? "Cerrar navegación" : "Abrir navegación"}
            title={isOpen ? "Cerrar navegación" : "Abrir navegación"}
          >
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition ${
                  isOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition ${
                  isOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition ${
                  isOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
            <span>{isOpen ? "Cerrar" : "Menú"}</span>
          </button>
        </div>

        <div
          id="app-navigation-menu"
          className={`${isOpen ? "block" : "hidden"} mt-3 rounded-[1.5rem] border border-stone-200 bg-white/92 p-2 shadow-[0_18px_44px_rgba(28,25,23,0.12)]`}
        >
          <nav className="grid grid-cols-2 gap-2" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const isActive = currentItem.href === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`min-h-20 rounded-[1.1rem] border px-3 py-3 transition ${
                    isActive
                      ? "border-stone-900 bg-stone-950 text-white shadow-[0_10px_22px_rgba(28,25,23,0.18)]"
                      : "border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300 hover:bg-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="block text-sm font-semibold leading-5">{item.label}</span>
                  <span
                    className={`mt-1 block text-xs leading-4 ${
                      isActive ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
