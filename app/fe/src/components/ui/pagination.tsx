import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      <p className="text-sm text-zinc-950/60">
        Showing {Math.min(pageSize, totalItems)} from {totalItems} data.
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="navigation"
          leftIcon={<ChevronLeft size={20} />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        {visiblePages.map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={pageNumber === page ? "primary" : "ghost"}
            onClick={() => onPageChange(pageNumber)}
            size="icon"
          >
            {pageNumber}
          </Button>
        ))}

        <Button
          rightIcon={<ChevronRight size={20} />}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
