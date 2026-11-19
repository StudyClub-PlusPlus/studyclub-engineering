'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

/**
 * design-system.md §9-2 계열 — 라디오. 같은 `name` 끼리 하나만 고른다. 라벨 클릭으로도 고르며 포커스 링은 Checkbox 와 같다.
 * 묶음의 제목은 부르는 쪽이 `<fieldset>` + `<legend>` 또는 `role='radiogroup'` + `aria-label` 로 단다.
 */
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** 라벨 아래 작은 설명(고르면 무엇이 달라지는지). */
  description?: ReactNode;
  /** 라벨이 화면에 보이지 않는 자리. 라벨은 스크린리더용으로만 남긴다. */
  hideLabel?: boolean;
}

export function Radio({ label, description, hideLabel = false, className, id, disabled, ...rest }: RadioProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label
      htmlFor={fieldId}
      className={cx(
        'inline-flex select-none gap-2',
        description ? 'items-start' : 'items-center',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input
        {...rest}
        id={fieldId}
        type='radio'
        disabled={disabled}
        className={cx(
          'h-4 w-4 shrink-0 cursor-pointer border-border accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring) disabled:cursor-not-allowed',
          description && 'mt-0.5',
        )}
      />
      <span className={hideLabel ? 'sr-only' : 'flex flex-col gap-0.5'}>
        <span className={cx('type-label-lg', disabled ? 'text-disabled-fg' : 'text-ink')}>{label}</span>
        {description && <span className='type-label-sm text-fg-muted'>{description}</span>}
      </span>
    </label>
  );
}
