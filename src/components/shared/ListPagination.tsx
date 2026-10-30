"use client";

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  previousAriaLabel: string;
  nextAriaLabel: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  tone?: "light" | "dark";
  layout?: "footer" | "inline";
};

export function ListPagination({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  previousAriaLabel,
  nextAriaLabel,
  canGoBack = currentPage > 1,
  canGoForward = currentPage < totalPages,
  tone = "light",
  layout = "inline",
}: ListPaginationProps) {
  const buttonClassName =
    tone === "dark"
      ? "rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-100 transition hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
      : "rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50";

  const controls = (
    <>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoBack}
        className={buttonClassName}
        aria-label={previousAriaLabel}
      >
        Anterior
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoForward}
        className={buttonClassName}
        aria-label={nextAriaLabel}
      >
        Siguiente
      </button>
    </>
  );

  if (layout === "footer") {
    return (
      <div className="border-t border-stone-200/80 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
          Página {currentPage} de {totalPages}
        </p>
        <div className="mt-3 flex items-center gap-3">{controls}</div>
      </div>
    );
  }

  return <div className="mt-3 flex items-center justify-end gap-2">{controls}</div>;
}
