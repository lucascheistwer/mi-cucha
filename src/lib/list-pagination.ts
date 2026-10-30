export const LIST_PAGE_SIZE = 5;

export type PageSlice<T> = {
  page: number;
  pageNumber: number;
  totalPages: number;
  items: T[];
  canGoBack: boolean;
  canGoForward: boolean;
};

export function slicePage<T>(
  items: readonly T[],
  page: number,
  pageSize = LIST_PAGE_SIZE
): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * pageSize;

  return {
    page: safePage,
    pageNumber: safePage + 1,
    totalPages,
    items: items.slice(startIndex, startIndex + pageSize),
    canGoBack: safePage > 0,
    canGoForward: safePage < totalPages - 1,
  };
}

export function sliceOneBasedPage<T>(
  items: readonly T[],
  page: number,
  pageSize = LIST_PAGE_SIZE
): PageSlice<T> {
  return slicePage(items, page - 1, pageSize);
}
