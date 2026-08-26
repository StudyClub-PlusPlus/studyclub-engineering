import type { HTMLAttributes } from 'react';

import { cx } from './cx';

/**
 * design-system.md §9-3.
 * bg-bg(흰색) · border 1px · radius-card · 패딩 20~24 · shadow-xs resting.
 * interactive: hover 시 shadow-md + translateY(-2px).
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'md' | 'lg';
}

const PADDING = { none: '', md: 'p-5', lg: 'p-6' } as const;

export function Card({ interactive = false, padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-card border border-border bg-bg shadow-xs',
        PADDING[padding],
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-base ease-out hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-(--ring)',
        className,
      )}
    >
      {children}
    </div>
  );
}
