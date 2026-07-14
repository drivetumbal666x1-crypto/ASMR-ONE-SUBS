"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const delta = 2; // pages to show around current
  const range: (number | "ellipsis")[] = [];

  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);

  range.push(1);

  if (start > 2) range.push("ellipsis");

  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  if (end < total - 1) range.push("ellipsis");

  if (total > 1) range.push(total);

  return range;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  const btnBase =
    "min-w-[32px] h-8 px-2 flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <nav className="flex items-center justify-center gap-1 flex-wrap py-4">
      <button
        onClick={() => onPageChange(1)}
        disabled={disabled || page === 1}
        className={`${btnBase} text-slate-500 hover:bg-slate-100`}
        aria-label="First page"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page === 1}
        className={`${btnBase} text-slate-500 hover:bg-slate-100`}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageNumbers.map((p, idx) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={disabled}
            className={`${btnBase} ${
              p === page
                ? "bg-pink-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page === totalPages}
        className={`${btnBase} text-slate-500 hover:bg-slate-100`}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={disabled || page === totalPages}
        className={`${btnBase} text-slate-500 hover:bg-slate-100`}
        aria-label="Last page"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
