'use client';

import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

/** design-system.md §9-2 계열 — 켜고 끄는 스위치. 누르는 즉시 상태가 바뀌는 설정(사이트 공개 등)에 쓴다. 제출하는 폼 안의 선택은 Checkbox. */
export type SwitchTone = 'brand' | 'success';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'onChange'> {
  checked: boolean;
  /** 스위치 왼쪽에 보이는 이름. 스크린리더도 이 이름을 읽는다. */
  label: string;
  /** 켜졌을 때 트랙 색. brand(기본) 는 일반 설정, success 는 「공개됨」처럼 켜진 상태가 좋은 소식일 때. */
  tone?: SwitchTone;
  onCheckedChange?: (next: boolean) => void;
}

const TRACK_ON: Record<SwitchTone, string> = {
  brand: 'bg-brand',
  success: 'bg-success-600',
};

/**
 * `aria-disabled` 만 주면 포커스는 받되 바뀌지 않는다 — 막힌 이유(`aria-describedby`)를 키보드 사용자도 읽게 할 때 쓴다.
 * `disabled` 는 포커스까지 막는다.
 */
export function Switch({
  checked,
  label,
  tone = 'brand',
  onCheckedChange,
  onClick,
  disabled,
  className,
  'aria-disabled': ariaDisabled,
  ...rest
}: SwitchProps) {
  const blocked = Boolean(disabled || ariaDisabled === true || ariaDisabled === 'true');
  return (
    <button
      type='button'
      {...rest}
      role='switch'
      aria-checked={checked}
      aria-disabled={ariaDisabled}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!blocked && !event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      className={cx(
        'inline-flex items-center gap-2 rounded-control px-1 py-0.5 type-label-lg text-fg-secondary outline-none focus-visible:shadow-(--ring)',
        blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      {label}
      <span
        aria-hidden='true'
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-base ease-in-out',
          checked ? TRACK_ON[tone] : 'bg-surface-3',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-surface-raised shadow-sm transition-transform duration-base ease-out',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
