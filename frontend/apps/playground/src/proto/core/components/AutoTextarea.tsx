'use client';

import { useLayoutEffect, useRef } from 'react';

import { cx } from '@studyclub/ui';

/** 내용만큼 늘어나는 글 상자. 긴 제목·규칙이 잘리지 않고 여러 줄로 보인다. */
export function AutoTextarea({
  label,
  value,
  placeholder,
  maxLength,
  minRows = 1,
  singleLine = false,
  invalid,
  className,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  /** 줄바꿈 키를 막는다 — 제목은 한 문장이고, 길면 접혀 보일 뿐이다. */
  singleLine?: boolean;
  invalid?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
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
      onKeyDown={(ev) => {
        if (singleLine && ev.key === 'Enter') ev.preventDefault();
      }}
      onChange={(ev) => onChange(singleLine ? ev.target.value.replace(/\n/g, ' ') : ev.target.value)}
      className={cx(
        'block w-full resize-none overflow-hidden rounded-control border bg-bg text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
        invalid ? 'border-error-500' : 'border-border-strong',
        className,
      )}
    />
  );
}
