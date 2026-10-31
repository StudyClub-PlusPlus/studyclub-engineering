'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

/** design-system.md §9-1 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'default' | 'error';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 실패 문구는 버튼 근처에서 role=alert 및 aria-describedby로 연결한다. */
  state?: ButtonState;
  /** 레이블과 아이콘을 유지하며 중복 실행을 막는다. 상태 표시는 사용처의 외부 role=status 영역에서 담당한다. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  state = 'default',
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  className,
  children,
  'aria-disabled': ariaDisabled,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading || ariaDisabled === true || ariaDisabled === 'true');
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-disabled={ariaDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-state={state}
      data-loading={loading || undefined}
      className={cx('sc-button', size === 'sm' ? 'type-label-sm' : 'type-label-lg', className)}
    >
      <span className='sc-button-content'>
        {leadingIcon && (
          <span className='sc-button-icon' aria-hidden='true'>
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className='sc-button-icon' aria-hidden='true'>
            {trailingIcon}
          </span>
        )}
      </span>
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'leadingIcon' | 'trailingIcon' | 'children'> {
  icon: ReactNode;
  'aria-label': string;
}

export function IconButton({ icon, className, ...rest }: IconButtonProps) {
  return (
    <Button {...rest} className={cx('sc-icon-button', className)}>
      <span className='sc-button-icon' aria-hidden='true'>
        {icon}
      </span>
    </Button>
  );
}
