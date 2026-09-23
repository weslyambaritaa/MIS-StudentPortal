import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const visiblePages = Array.from(
    {
      length: Math.min(totalPages, 3),
    },
    (_, index) => index + 1
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Showing {Math.min(pageSize, totalItems)} from {totalItems} data.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-2 text-sm text-[var(--color-primary)] disabled:opacity-40"
        >
          <ChevronLeft size={17} />
          Previous
        </button>

        {visiblePages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-full text-sm",
              pageNumber === page
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-10 items-center gap-3 rounded-full bg-[var(--color-primary)] px-5 text-sm text-white disabled:opacity-40"
        >
          Next
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
