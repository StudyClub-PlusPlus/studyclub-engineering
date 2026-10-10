'use client';

import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

/**
 * design-system.md §9-8 Filter Chip.
 * 미선택: surface-raised + border + text-secondary
 * 선택(다중): primary-light + primary-dark / 선택(단일): primary solid
 */
export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** single = 라디오처럼 하나만 고르는 그룹 → 선택 시 solid */
  selectMode?: 'single' | 'multi';
}

export function FilterChip({ selected = false, selectMode = 'multi', className, children, ...rest }: FilterChipProps) {
  const solid = selected && selectMode === 'single';
  return (
    <button
      {...rest}
      type='button'
      aria-pressed={selected}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-sm font-medium',
        'transition-[background-color,border-color,color] duration-fast ease-out',
        'focus-visible:outline-none focus-visible:shadow-(--ring)',
        solid
          ? 'border border-transparent bg-brand text-on-brand hover:bg-brand-hover'
          : selected
            ? 'border border-border-strong bg-primary-light text-primary-dark hover:brightness-[0.97]'
            : 'border border-border bg-surface-raised text-text-secondary hover:border-border-interactive hover:bg-page-bg',
        className,
      )}
    >
      {children}
    </button>
  );
}
