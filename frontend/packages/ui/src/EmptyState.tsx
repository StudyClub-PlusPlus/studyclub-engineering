import type { ReactNode } from 'react';

import { cx } from './cx';

/**
 * design-system.md §9-8 Empty State.
 * 아이콘 + 안내 카피(~해요체) + 주요 CTA.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-14 text-center',
        className,
      )}
    >
      {icon && <span className='text-fg-placeholder'>{icon}</span>}
      <div className='flex flex-col gap-1'>
        <p className='text-base font-semibold text-neutral-900'>{title}</p>
        {description && <p className='text-sm text-fg-muted'>{description}</p>}
      </div>
      {action && <div className='mt-1'>{action}</div>}
    </div>
  );
}
