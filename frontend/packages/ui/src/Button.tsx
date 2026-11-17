'use client';

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { cx } from './cx';

/** design-system.md §9-1 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonState = 'default' | 'error';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 포커스를 되돌릴 때(메뉴 닫기 등) 쓴다. React 19 라 forwardRef 없이 그대로 button 에 닿는다. */
  ref?: Ref<HTMLButtonElement>;
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

export type IconButtonSize = ButtonSize | 'xs';

export interface IconButtonProps extends Omit<ButtonProps, 'leadingIcon' | 'trailingIcon' | 'children' | 'size'> {
  icon: ReactNode;
  'aria-label': string;
  /** xs(24px)는 IconButton 전용 — 표 칸처럼 줄 높이를 지켜야 하는 자리. 터치 장치에서는 누르는 영역이 44px 로 넓어진다. */
  size?: IconButtonSize;
}

export function IconButton({ icon, className, size = 'md', ...rest }: IconButtonProps) {
  return (
    // xs 는 data-size 로만 쓰이고(buttons.css) 글자 크기 분기에는 닿지 않는다
    <Button {...rest} size={size as ButtonSize} className={cx('sc-icon-button', className)}>
      <span className='sc-button-icon' aria-hidden='true'>
        {icon}
      </span>
    </Button>
  );
}
