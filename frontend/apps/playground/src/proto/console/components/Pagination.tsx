import { ChevronLeft, ChevronRight } from 'lucide-react';

/** 페이지 번호 목록 — 항상 최대 7칸. 앞뒤가 잘리는 자리에는 「…」 를 둔다. */
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

export function Pagination({
  page,
  total,
  onChange,
  anno,
}: {
  page: number;
  total: number;
  onChange: (next: number) => void;
  anno?: string;
}) {
  if (total <= 1) return null;
  const cell = 'grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm transition-colors';
  return (
    <nav data-anno={anno} className='mt-4 flex items-center justify-center gap-1'>
      <button
        type='button'
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label='이전 페이지'
        className={`${cell} text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <ChevronLeft size={16} />
      </button>
      {pageWindow(page, total).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={`${cell} text-fg-placeholder`}>
            …
          </span>
        ) : (
          <button
            key={n}
            type='button'
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${cell} tnum ${
              n === page ? 'bg-surface-2 font-bold text-fg' : 'text-fg-muted hover:bg-surface-2'
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type='button'
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        aria-label='다음 페이지'
        className={`${cell} text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
