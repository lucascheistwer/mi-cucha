"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TRIP_SUB_NAV_ITEMS = [
  { key: "gastos", label: "Gastos", suffix: "" },
  { key: "resumen", label: "Resumen", suffix: "/resumen" },
  { key: "estadisticas", label: "Estadísticas", suffix: "/estadisticas" },
] as const;

type TripSubNavProps = {
  tripId: string;
};

export function TripSubNav({ tripId }: TripSubNavProps) {
  const pathname = usePathname();
  const basePath = `/viajes/${tripId}`;

  return (
    <nav
      aria-label="Navegación del viaje"
      className="grid grid-cols-3 gap-1 rounded-full bg-stone-100 p-1"
    >
      {TRIP_SUB_NAV_ITEMS.map((item) => {
        const href = `${basePath}${item.suffix}`;
        const isActive = pathname === href;

        return (
          <Link
            key={item.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] transition ${
              isActive
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
