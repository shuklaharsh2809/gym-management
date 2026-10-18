import { ChevronLeft, ChevronRight } from "@/components/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Previous/next links that keep the current search params. */
export function Pagination({
  page,
  pageCount,
  total,
  params,
  noun = "results",
}: {
  page: number;
  pageCount: number;
  total: number;
  params: Record<string, string | undefined>;
  noun?: string;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
      <p className="text-muted-foreground">
        {total} {noun}
        {pageCount > 1 && ` · page ${page} of ${pageCount}`}
      </p>
      {pageCount > 1 && (
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(page - 1)}>
                <ChevronLeft aria-hidden /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <ChevronLeft aria-hidden /> Previous
            </Button>
          )}
          {page < pageCount ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(page + 1)}>
                Next <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              Next <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
