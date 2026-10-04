import type { HTMLAttributes } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from './cx';

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** 현재 페이지 (1-based) */
  page: number;
  /** 전체 페이지 수 */
  total: number;
  /** 페이지 변경 핸들러 */
  onChange: (page: number) => void;
}

/** 페이지 번호 창 — 최대 7칸 (1, …, page-1, page, page+1, …, total) */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((n) => n > 1 && n < total);
  const items: (number | 'gap')[] = [1];
  if (around[0] !== undefined && around[0] > 2) items.push('gap');
  items.push(...around);
  const last = around[around.length - 1];
  if (last !== undefined && last < total - 1) items.push('gap');
  items.push(total);
  return items;
}

/**
 * design-system.md §9-8 Pagination.
 *
 * - 숫자/화살표 버튼: h-8 min-w-8, rounded-control
 * - active: bg-surface-2 font-bold text-fg
 * - inactive: text-fg-muted hover:bg-surface-2
 */
export function Pagination({ page, total, onChange, className, ...rest }: PaginationProps) {
  if (total <= 1) return null;

  const cell =
    'grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm transition-colors focus-visible:outline-none focus-visible:shadow-(--ring)';

  return (
    <nav
      aria-label='페이지 네비게이션'
      className={cx('flex items-center justify-center gap-1', className)}
      {...rest}
    >
      <button
        type='button'
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label='이전 페이지'
        className={cx(
          cell,
          'text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        )}
      >
        <ChevronLeft size={16} />
      </button>

      {pageWindow(page, total).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={cx(cell, 'text-fg-placeholder')}>
            …
          </span>
        ) : (
          <button
            key={n}
            type='button'
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cx(
              cell,
              'tnum',
              n === page ? 'bg-surface-2 font-bold text-fg' : 'text-fg-muted hover:bg-surface-2',
            )}
          >
            {n}
          </button>
        ),
      )}

      <button
        type='button'
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        aria-label='다음 페이지'
        className={cx(
          cell,
          'text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        )}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
