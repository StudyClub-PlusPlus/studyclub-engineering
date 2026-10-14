'use client';

import { useLayoutEffect, useRef } from 'react';

import { cx } from './cx';

export interface AutoTextareaProps {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  /** 줄바꿈 키를 막는다 — 제목처럼 한 줄 입력에서 사용. */
  singleLine?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}

/** 내용만큼 늘어나는 텍스트 영역. Field.tsx Textarea 와 동일한 디자인 토큰을 사용한다. */
export function AutoTextarea({
  label,
  value,
  placeholder,
  maxLength,
  minRows = 1,
  singleLine = false,
  invalid,
  disabled,
  className,
  onChange,
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={minRows}
      disabled={disabled}
      onKeyDown={(ev) => {
        if (singleLine && ev.key === 'Enter') ev.preventDefault();
      }}
      onChange={(ev) =>
        onChange(singleLine ? ev.target.value.replace(/\n/g, ' ') : ev.target.value)
      }
      className={cx(
        'w-full resize-none overflow-hidden rounded-control border bg-bg px-3.5 py-2.5 text-sm text-neutral-900',
        'leading-relaxed placeholder:text-fg-placeholder',
        'transition-[border-color,box-shadow] duration-fast ease-out',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-neutral-400',
        invalid
          ? 'border-error-600 focus:border-error-600 focus:shadow-(--ring-error)'
          : 'border-border-strong focus:border-brand focus:shadow-(--ring)',
        className,
      )}
    />
  );
}
