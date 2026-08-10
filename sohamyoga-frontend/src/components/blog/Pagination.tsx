'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export default function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    return `${basePath}?${params.toString()}`;
  };

  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Blog pagination">
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={getPageUrl(currentPage - 1)}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-dark-600 bg-white border border-dark-200 rounded-lg hover:bg-dark-50 hover:border-primary-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-dark-300 bg-dark-50 border border-dark-100 rounded-lg cursor-not-allowed">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </span>
      )}

      {/* Page Numbers */}
      <div className="hidden sm:flex items-center gap-1">
        {pages.map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`ellipsis-${idx}`} className="px-3 py-2 text-dark-400">
              ...
            </span>
          ) : (
            <Link
              key={page}
              href={getPageUrl(page)}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-dark-600 bg-white border border-dark-200 hover:bg-dark-50 hover:border-primary-300'
              }`}
            >
              {page}
            </Link>
          )
        )}
      </div>

      {/* Mobile page indicator */}
      <span className="sm:hidden text-sm text-dark-500">
        Page {currentPage} of {totalPages}
      </span>

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={getPageUrl(currentPage + 1)}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-dark-600 bg-white border border-dark-200 rounded-lg hover:bg-dark-50 hover:border-primary-300 transition-colors"
        >
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-dark-300 bg-dark-50 border border-dark-100 rounded-lg cursor-not-allowed">
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      )}
    </nav>
  );
}
