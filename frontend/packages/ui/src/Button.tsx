'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

/** design-system.md §9-1 */
export type ButtonVariant = 'primary' | 'tonal' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand shadow-xs hover:bg-brand-hover active:bg-brand-active',
  tonal: 'bg-brand-subtle text-primary-700 hover:bg-brand-subtle-hover',
  secondary: 'bg-bg text-neutral-800 border border-border-strong hover:bg-surface-1 hover:border-border-interactive',
  ghost: 'bg-transparent text-neutral-700 hover:bg-surface-2',
  destructive: 'bg-error-600 text-on-brand shadow-xs hover:bg-error-700',
};

/* h32/40/48 — sm 은 시각 높이를 유지한 채 ::after 로 44px 터치 타깃을 확보한다. */
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

const HIT_AREA = "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 라벨과 폭을 유지한 채 스피너만 덧붙인다 (§9-1). */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center rounded-control font-semibold',
        'transition-[background-color,border-color,box-shadow,transform] duration-fast ease-out',
        'focus-visible:outline-none focus-visible:shadow-(--ring)',
        // disabled 는 변형 색을 전부 덮는다 (§9-1)
        'disabled:pointer-events-none disabled:border-transparent disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none',
        SIZE[size],
        size === 'sm' && HIT_AREA,
        VARIANT[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

function Spinner() {
  return (
    <svg className='h-4 w-4 shrink-0 animate-spin' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
      <circle cx='8' cy='8' r='6.5' stroke='currentColor' strokeOpacity='0.25' strokeWidth='2.5' />
      <path d='M14.5 8A6.5 6.5 0 0 0 8 1.5' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' />
    </svg>
  );
}
