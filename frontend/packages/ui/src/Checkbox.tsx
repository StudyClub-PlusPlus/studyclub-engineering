'use client';

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import { cx } from './cx';

/** design-system.md §9-2 계열 — 체크박스. 라벨 클릭으로도 토글되며 포커스 링을 공유한다. */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  indeterminate?: boolean;
  /** 표의 행 선택처럼 라벨이 화면에 보이지 않는 자리. 라벨은 스크린리더용으로만 남긴다. */
  hideLabel?: boolean;
}

export function Checkbox({ label, className, id, indeterminate = false, hideLabel = false, ...rest }: CheckboxProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className={cx('inline-flex cursor-pointer select-none items-center gap-2', className)}>
      <input
        {...rest}
        id={fieldId}
        type='checkbox'
        ref={(element) => {
          if (element) element.indeterminate = indeterminate;
        }}
        className='h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring)'
      />
      <span className={hideLabel ? 'sr-only' : 'type-label-lg text-ink'}>{label}</span>
    </label>
  );
}
