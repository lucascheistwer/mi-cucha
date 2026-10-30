"use client";

import type { ReactNode } from "react";

import { ListPagination } from "@/components/shared/ListPagination";
import { LIST_PAGE_SIZE, slicePage } from "@/lib/list-pagination";
import { formatCurrency } from "@/lib/utils";

type StatTile = {
  label: string;
  value: string | number;
  detail?: string;
};

type BalanceOverviewProps = {
  eyebrow: string;
  total: string;
  primaryStat: StatTile;
  secondaryStat: StatTile;
  pending?: {
    hasPending: boolean;
    value: string;
    detail: string;
  };
};

export type PersonBalanceRow = {
  id: string;
  name: string;
  responsibilityLabel: string;
  paidLabel: string;
  targetLabel: string | null;
  balanceLabel: string | null;
};

export type PaymentRow = {
  id: string;
  title: string;
  meta: string;
  amount: string;
};

export type CategoryBreakdownItem = {
  key: string;
  icon: string;
  label: string;
  total: number;
  percentage: number;
  count: number;
};

export type FilteredExpensePreview = {
  id: string;
  meta: string;
  title: string;
  amount: number;
};

type CategoryBreakdownProps = {
  currency?: "ARS" | "USD";
  scopeLabel: string;
  totalCount: number;
  totalAmount: number;
  categories: CategoryBreakdownItem[];
  selectedKey: string;
  allKey: string;
  selectedLabel: string;
  selectedTotal: number;
  filteredExpenses: FilteredExpensePreview[];
  onSelect: (key: string) => void;
  categoryPage: number;
  onCategoryPageChange: (page: number) => void;
  filteredPage: number;
  onFilteredPageChange: (page: number) => void;
};

export type MeterItem = {
  id: string;
  label: string;
  amountLabel: string;
  percentage: number;
};

type MeterListProps = {
  title: string;
  items: MeterItem[];
  page: number;
  onPageChange: (page: number) => void;
};

export function SummaryPanel({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,244,240,0.98))] p-5 text-stone-950 shadow-[0_18px_50px_rgba(28,25,23,0.12)]">
      {children}
    </section>
  );
}

export function BalanceOverview({
  eyebrow,
  total,
  primaryStat,
  secondaryStat,
  pending,
}: BalanceOverviewProps) {
  return (
    <div
      className={
        pending
          ? "grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(16rem,18rem)]"
          : "space-y-3"
      }
    >
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          {eyebrow}
        </p>
        <strong className="block text-4xl font-semibold text-stone-950">{total}</strong>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
              {primaryStat.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-950">{primaryStat.value}</p>
          </div>
          <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50/70 px-4 py-3 shadow-[0_10px_24px_rgba(13,148,136,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">
              {secondaryStat.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-teal-950">{secondaryStat.value}</p>
            {secondaryStat.detail ? (
              <p className="text-xs text-teal-800">{secondaryStat.detail}</p>
            ) : null}
          </div>
        </div>
      </div>
      {pending ? (
        <div
          className={`rounded-[1.5rem] border px-5 py-4 shadow-[0_14px_32px_rgba(28,25,23,0.08)] ${
            pending.hasPending
              ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(254,243,199,0.92))]"
              : "border-teal-200 bg-[linear-gradient(180deg,rgba(240,253,250,1),rgba(204,251,241,0.85))]"
          }`}
        >
          <p
            className={`text-[11px] uppercase tracking-[0.2em] ${
              pending.hasPending ? "text-amber-700" : "text-teal-700"
            }`}
          >
            pendiente
          </p>
          <p
            className={`mt-2 text-3xl font-semibold ${
              pending.hasPending ? "text-amber-950" : "text-teal-950"
            }`}
          >
            {pending.value}
          </p>
          <p
            className={`mt-2 text-sm leading-6 ${
              pending.hasPending ? "text-amber-900" : "text-teal-900"
            }`}
          >
            {pending.detail}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function PersonBalanceList({
  people,
  page,
  onPageChange,
}: {
  people: PersonBalanceRow[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const slice = slicePage(people, page);

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          Personas
        </p>
        <p className="text-xs font-medium text-stone-500">
          Página {slice.pageNumber} de {slice.totalPages}
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        {slice.items.map((person) => (
          <div
            key={person.id}
            className="rounded-[1.2rem] border border-stone-200 bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-950">{person.name}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  {person.responsibilityLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-stone-950">{person.paidLabel}</p>
                {person.targetLabel ? (
                  <p className="text-xs text-stone-500">{person.targetLabel}</p>
                ) : null}
              </div>
            </div>
            {person.balanceLabel ? (
              <p className="mt-2 text-xs font-medium text-teal-700">{person.balanceLabel}</p>
            ) : null}
          </div>
        ))}
      </div>

      {people.length > LIST_PAGE_SIZE ? (
        <ListPagination
          currentPage={slice.pageNumber}
          totalPages={slice.totalPages}
          canGoBack={slice.canGoBack}
          canGoForward={slice.canGoForward}
          onPrevious={() => onPageChange(Math.max(slice.page - 1, 0))}
          onNext={() => onPageChange(Math.min(slice.page + 1, slice.totalPages - 1))}
          previousAriaLabel="Ver página anterior de personas"
          nextAriaLabel="Ver página siguiente de personas"
        />
      ) : null}
    </>
  );
}

export function DebtSettlementCard({
  hasSettlement,
  settlement,
  message,
  settledHeadline,
}: {
  hasSettlement: boolean;
  settlement: {
    fromNombre: string;
    toNombre: string;
    amountLabel: string;
  } | null;
  message: string;
  settledHeadline: string;
}) {
  return (
    <div
      className={`mt-4 rounded-[1.4rem] border px-4 py-4 ${
        hasSettlement ? "border-amber-200 bg-amber-50" : "border-teal-200 bg-teal-50"
      }`}
    >
      {hasSettlement && settlement ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Transferencia sugerida
          </p>
          <p className="text-lg font-semibold leading-7 text-amber-950">
            {settlement.fromNombre} le debe {settlement.amountLabel} a {settlement.toNombre}
          </p>
          <p className="text-sm leading-6 text-amber-900">{message}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Resumen equilibrado
          </p>
          <p className="text-lg font-semibold leading-7 text-teal-950">{settledHeadline}</p>
          <p className="text-sm leading-6 text-teal-900">{message}</p>
        </div>
      )}
    </div>
  );
}

export function PaymentsPanel({
  title,
  registeredCount,
  rows,
  page,
  onPageChange,
  emptyMessage,
  children,
}: {
  title: string;
  registeredCount: number;
  rows: PaymentRow[];
  page: number;
  onPageChange: (page: number) => void;
  emptyMessage: string;
  children?: ReactNode;
}) {
  const slice = slicePage(rows, page);

  return (
    <div className="mt-4 rounded-[1.3rem] border border-stone-200 bg-stone-950 px-4 py-4 text-white shadow-[0_14px_32px_rgba(28,25,23,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-300">
          {title}
        </h2>
        <div className="text-right">
          <p className="text-xs text-stone-400">{registeredCount} registrados</p>
          <p className="mt-1 text-xs text-stone-500">
            Página {slice.pageNumber} de {slice.totalPages}
          </p>
        </div>
      </div>

      {children}

      <div className="mt-4 space-y-2">
        {rows.length > 0 ? (
          slice.items.map((payment) => (
            <div
              key={payment.id}
              className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{payment.title}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-400">
                    {payment.meta}
                  </p>
                </div>
                <strong className="text-sm font-semibold text-teal-300">{payment.amount}</strong>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-4 text-sm text-stone-300">
            {emptyMessage}
          </p>
        )}
      </div>

      {rows.length > LIST_PAGE_SIZE ? (
        <ListPagination
          tone="dark"
          currentPage={slice.pageNumber}
          totalPages={slice.totalPages}
          canGoBack={slice.canGoBack}
          canGoForward={slice.canGoForward}
          onPrevious={() => onPageChange(Math.max(slice.page - 1, 0))}
          onNext={() => onPageChange(Math.min(slice.page + 1, slice.totalPages - 1))}
          previousAriaLabel="Ver página anterior de pagos"
          nextAriaLabel="Ver página siguiente de pagos"
        />
      ) : null}
    </div>
  );
}

export function CategoryBreakdown({
  currency = "ARS",
  scopeLabel,
  totalCount,
  totalAmount,
  categories,
  selectedKey,
  allKey,
  selectedLabel,
  selectedTotal,
  filteredExpenses,
  onSelect,
  categoryPage,
  onCategoryPageChange,
  filteredPage,
  onFilteredPageChange,
}: CategoryBreakdownProps) {
  const categorySlice = slicePage(categories, categoryPage);
  const filteredSlice = slicePage(filteredExpenses, filteredPage);

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Categorías</h2>
          <p className="mt-1 text-sm text-stone-500">
            {selectedLabel} · {filteredExpenses.length} gastos
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Página {categorySlice.pageNumber} de {categorySlice.totalPages}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
          {formatCurrency(selectedTotal, currency)}
        </span>
      </div>

      {categories.length > 0 ? (
        <>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => onSelect(allKey)}
              aria-pressed={selectedKey === allKey}
              className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                selectedKey === allKey
                  ? "border-teal-300 bg-teal-50 shadow-[0_12px_28px_rgba(13,148,136,0.12)]"
                  : "border-stone-200 bg-white/80 hover:border-stone-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-stone-900">
                    Todas las categorías
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {totalCount} gastos · 100% {scopeLabel}
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-stone-700">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full w-full rounded-full bg-teal-500 transition-[width]" />
              </div>
            </button>

            {categorySlice.items.map((category) => {
              const isSelected = selectedKey === category.key;

              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => onSelect(category.key)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-teal-300 bg-teal-50 shadow-[0_12px_28px_rgba(13,148,136,0.12)]"
                      : "border-stone-200 bg-white/80 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-stone-900">
                        {category.icon} {category.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {category.count} gastos · {category.percentage}% {scopeLabel}
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold text-stone-700">
                      {formatCurrency(category.total, currency)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-[width]"
                      style={{
                        width: `${Math.min(Math.max(category.percentage, 6), 100)}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {categories.length > LIST_PAGE_SIZE ? (
            <ListPagination
              currentPage={categorySlice.pageNumber}
              totalPages={categorySlice.totalPages}
              canGoBack={categorySlice.canGoBack}
              canGoForward={categorySlice.canGoForward}
              onPrevious={() => onCategoryPageChange(Math.max(categorySlice.page - 1, 0))}
              onNext={() =>
                onCategoryPageChange(Math.min(categorySlice.page + 1, categorySlice.totalPages - 1))
              }
              previousAriaLabel="Ver página anterior de categorías"
              nextAriaLabel="Ver página siguiente de categorías"
            />
          ) : null}

          <div className="mt-5 rounded-[1.4rem] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Gastos filtrados
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Página {filteredSlice.pageNumber} de {filteredSlice.totalPages}
                </p>
              </div>
              <span className="text-xs font-medium text-stone-500">{filteredExpenses.length}</span>
            </div>

            {filteredExpenses.length > 0 ? (
              <div className="mt-3 space-y-2">
                {filteredSlice.items.map((expense) => (
                  <article
                    key={expense.id}
                    className="rounded-[1.1rem] border border-white bg-white px-3 py-3 shadow-[0_8px_22px_rgba(28,25,23,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                          {expense.meta}
                        </p>
                        <h4 className="mt-1 truncate text-sm font-semibold text-stone-950">
                          {expense.title}
                        </h4>
                      </div>
                      <strong className="shrink-0 text-sm font-semibold text-stone-950">
                        {formatCurrency(expense.amount, currency)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[1.1rem] border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
                Sin gastos para este filtro.
              </p>
            )}

            {filteredExpenses.length > LIST_PAGE_SIZE ? (
              <>
                <p className="mt-3 text-xs text-stone-500">
                  Mostrando {filteredSlice.items.length} de {filteredExpenses.length} gastos.
                </p>
                <ListPagination
                  currentPage={filteredSlice.pageNumber}
                  totalPages={filteredSlice.totalPages}
                  canGoBack={filteredSlice.canGoBack}
                  canGoForward={filteredSlice.canGoForward}
                  onPrevious={() => onFilteredPageChange(Math.max(filteredSlice.page - 1, 0))}
                  onNext={() =>
                    onFilteredPageChange(
                      Math.min(filteredSlice.page + 1, filteredSlice.totalPages - 1)
                    )
                  }
                  previousAriaLabel="Ver página anterior de gastos filtrados"
                  nextAriaLabel="Ver página siguiente de gastos filtrados"
                />
              </>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-stone-600">Sin categorías registradas.</p>
      )}
    </section>
  );
}

export function MeterList({ title, items, page, onPageChange }: MeterListProps) {
  const slice = slicePage(items, page);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="text-xs font-medium text-stone-500">
          Página {slice.pageNumber} de {slice.totalPages}
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {slice.items.map((item) => (
          <div
            key={item.id}
            className="rounded-[1.3rem] border border-stone-200 bg-white/80 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="font-semibold text-stone-900">{item.label}</span>
              <span className="shrink-0 font-semibold text-stone-700">
                {item.amountLabel} · {item.percentage}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-teal-500 transition-[width]"
                style={{ width: `${Math.min(Math.max(item.percentage, 6), 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {items.length > LIST_PAGE_SIZE ? (
        <ListPagination
          currentPage={slice.pageNumber}
          totalPages={slice.totalPages}
          canGoBack={slice.canGoBack}
          canGoForward={slice.canGoForward}
          onPrevious={() => onPageChange(Math.max(slice.page - 1, 0))}
          onNext={() => onPageChange(Math.min(slice.page + 1, slice.totalPages - 1))}
          previousAriaLabel={`Ver página anterior de ${title}`}
          nextAriaLabel={`Ver página siguiente de ${title}`}
        />
      ) : null}
    </section>
  );
}
