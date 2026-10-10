import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

export interface NavItem {
  key: string;
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface NavProps extends HTMLAttributes<HTMLElement> {
  /** 네비게이션 형태: 'site' (상단 가로 네비) | 'sidebar' (운영자 콘솔 좌측 사이드바) */
  variant?: 'site' | 'sidebar';
  /** 로고 / 브랜드 영역 */
  brand?: ReactNode;
  /** 네비게이션 링크/버튼 목록 */
  items: NavItem[];
  /** 우측(사이트) 또는 하단(사이드바) 추가 액션 슬롯 */
  actions?: ReactNode;
}

/**
 * design-system.md §9-8 Nav.
 *
 * - 사이트: 상단 가로 네비(흰 bg + border 하단)
 * - 콘솔: 좌측 사이드바(page-bg, active: primary-light + primary-dark)
 */
export function Nav({
  variant = 'site',
  brand,
  items,
  actions,
  className,
  ...rest
}: NavProps) {
  if (variant === 'sidebar') {
    return (
      <aside
        className={cx('flex h-full w-56 flex-col border-r border-border bg-surface-1', className)}
        {...rest}
      >
        {brand && (
          <div className='flex h-16 shrink-0 items-center border-b border-border px-5 text-[15px] font-bold'>
            {brand}
          </div>
        )}

        <nav className='flex flex-1 flex-col gap-1 p-3'>
          {items.map((item) => {
            const content = (
              <>
                {item.icon && <span className='shrink-0'>{item.icon}</span>}
                <span className='truncate'>{item.label}</span>
              </>
            );

            const itemClass = cx(
              'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-(--ring)',
              item.active
                ? 'bg-primary-light font-semibold text-primary-dark'
                : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              item.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-fg-muted',
            );

            if (item.href && !item.disabled) {
              return (
                <a key={item.key} href={item.href} onClick={item.onClick} className={itemClass}>
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type='button'
                disabled={item.disabled}
                onClick={item.onClick}
                className={itemClass}
              >
                {content}
              </button>
            );
          })}
        </nav>

        {actions && <div className='shrink-0 border-t border-border p-3'>{actions}</div>}
      </aside>
    );
  }

  // site (상단 가로 네비)
  return (
    <header
      className={cx(
        'sticky top-0 z-30 flex h-16 w-full items-center border-b border-border bg-bg/95 px-6 backdrop-blur-md',
        className,
      )}
      {...rest}
    >
      <div className='flex w-full items-center justify-between gap-6'>
        {brand && <div className='shrink-0 font-bold'>{brand}</div>}

        <nav className='flex items-center gap-6'>
          {items.map((item) => {
            const itemClass = cx(
              'flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-(--ring)',
              item.active ? 'font-semibold text-fg' : 'text-fg-muted hover:text-fg',
              item.disabled && 'cursor-not-allowed opacity-40 hover:text-fg-muted',
            );

            if (item.href && !item.disabled) {
              return (
                <a key={item.key} href={item.href} onClick={item.onClick} className={itemClass}>
                  {item.icon}
                  {item.label}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type='button'
                disabled={item.disabled}
                onClick={item.onClick}
                className={itemClass}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {actions && <div className='ml-auto flex items-center gap-3'>{actions}</div>}
      </div>
    </header>
  );
}
