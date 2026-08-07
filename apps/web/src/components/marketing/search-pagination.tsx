import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

function hrefFor(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set('page', String(page));
  return `${basePath}?${search.toString()}`;
}

export function SearchPagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = new Set<number>(
    [1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages),
  );
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={page > 1 ? hrefFor(basePath, params, page - 1) : undefined}
            aria-disabled={page <= 1}
          />
        </PaginationItem>

        {sorted.map((p, i) => (
          <PaginationItem key={p}>
            {i > 0 && p - sorted[i - 1]! > 1 && <PaginationEllipsis />}
            <PaginationLink href={hrefFor(basePath, params, p)} isActive={p === page}>
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href={page < totalPages ? hrefFor(basePath, params, page + 1) : undefined}
            aria-disabled={page >= totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
