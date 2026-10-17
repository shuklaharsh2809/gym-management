/** Parsed list parameters from URL search params, with allow-listed sorting. */
export interface ListParams<S extends string> {
  page: number;
  pageSize: number;
  q: string;
  sort: S;
  dir: "asc" | "desc";
}

export function parseListParams<S extends string>(
  search: Record<string, string | string[] | undefined>,
  options: { sorts: readonly S[]; defaultSort: S; defaultDir?: "asc" | "desc"; pageSize?: number },
): ListParams<S> {
  const one = (k: string) => {
    const v = search[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one("page") ?? "1", 10) || 1));
  const sortParam = one("sort");
  const sort = options.sorts.includes(sortParam as S) ? (sortParam as S) : options.defaultSort;
  const dirParam = one("dir");
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : (options.defaultDir ?? "asc");
  return {
    page,
    pageSize: options.pageSize ?? 25,
    q: (one("q") ?? "").trim().slice(0, 100),
    sort,
    dir,
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

export function pageMeta(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { pageCount, page: Math.min(page, pageCount) };
}
