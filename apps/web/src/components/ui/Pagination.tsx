'use client';

import styles from './Pagination.module.css';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

const VISIBLE_PAGE_COUNT = 5;

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  'aria-label': ariaLabel = '페이지 이동',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startPage = Math.max(
    1,
    Math.min(
      currentPage - Math.floor(VISIBLE_PAGE_COUNT / 2),
      totalPages - VISIBLE_PAGE_COUNT + 1,
    ),
  );
  const endPage = Math.min(startPage + VISIBLE_PAGE_COUNT - 1, totalPages);
  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index,
  );

  function handlePageChange(page: number) {
    if (disabled || page === currentPage || page < 1 || page > totalPages)
      return;
    onPageChange(page);
  }

  return (
    <nav
      className={[styles.pagination, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={styles.button}
        aria-label="이전 페이지"
        disabled={disabled || currentPage <= 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m10 4-4 4 4 4" fill="none" stroke="currentColor" />
        </svg>
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={styles.button}
          aria-label={`${page}페이지`}
          aria-current={page === currentPage ? 'page' : undefined}
          disabled={disabled}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className={styles.button}
        aria-label="다음 페이지"
        disabled={disabled || currentPage >= totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" />
        </svg>
      </button>
    </nav>
  );
}
