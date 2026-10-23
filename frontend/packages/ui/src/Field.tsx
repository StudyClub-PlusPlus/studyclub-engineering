'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { ChevronDown } from 'lucide-react';

import { cx } from './cx';

/** design-system.md §9-2 — 입력 계열 공통 셸. */
const CONTROL_BASE = cx(
  'w-full rounded-control border bg-surface-raised px-3.5 text-sm text-ink',
  'placeholder:text-fg-placeholder',
  'transition-[border-color,box-shadow] duration-fast ease-out',
  'focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg',
);

const CONTROL_OK = 'border-border focus:border-border-interactive focus:shadow-(--ring)';
const CONTROL_ERROR = 'border-danger-fg focus:border-danger-fg focus:shadow-(--ring-error)';

function controlClass(invalid: boolean, extra?: string) {
  return cx(CONTROL_BASE, invalid ? CONTROL_ERROR : CONTROL_OK, extra);
}

export interface FieldShellProps {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** 라벨 우측에 붙는 짧은 보조 문구(글자수 권장·단위 등). helper 와 달리 줄을 차지하지 않는다. */
  labelHint?: ReactNode;
  htmlFor?: string;
  /** helper/error 문구의 id. 컨트롤이 `aria-describedby` 로 가리켜 스크린리더가 문구를 함께 읽는다. */
  messageId?: string;
  children: ReactNode;
}

/** 라벨 + 컨트롤 + helper/error 를 묶는다. error 가 있으면 helper 대신 error 를 보여준다. */
export function FieldShell({ label, helper, error, required, labelHint, htmlFor, messageId, children }: FieldShellProps) {
  const message = error ?? helper;
  return (
    <div className='flex flex-col gap-1.5'>
      {(label || labelHint) && (
        <div className='flex items-baseline justify-between gap-2'>
          <label htmlFor={htmlFor} className='text-sm font-medium text-ink'>
            {label}
            {required && (
              <span className='ml-0.5 text-danger-fg' aria-hidden='true'>
                *
              </span>
            )}
          </label>
          {labelHint && <span className='shrink-0 text-xs text-fg-placeholder'>{labelHint}</span>}
        </div>
      )}
      {children}
      {message && (
        <p id={messageId} className={cx('text-xs', error ? 'text-danger-fg' : 'text-fg-muted')}>
          {message}
        </p>
      )}
    </div>
  );
}

type FieldMeta = Pick<FieldShellProps, 'label' | 'helper' | 'error' | 'required' | 'labelHint'>;

/**
 * helper/error 문구를 컨트롤에 잇는다. 문구가 있을 때만 id 를 만들고, 부르는 쪽이 넘긴 `aria-describedby` 뒤에 붙인다.
 * 라벨 없이 `aria-label` 만 쓰는 표 칸도 오류 문구를 읽게 된다.
 */
function describedBy(fieldId: string, meta: Pick<FieldMeta, 'error' | 'helper'>, external?: string) {
  const messageId = meta.error || meta.helper ? `${fieldId}-message` : undefined;
  return { messageId, ariaDescribedBy: [external, messageId].filter(Boolean).join(' ') || undefined };
}

export type InputSize = 'sm' | 'md' | 'lg';

const INPUT_SIZES: Record<InputSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldMeta {
  size?: InputSize;
}

export function Input({ label, helper, error, required, labelHint, className, id, size = 'md', ...rest }: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  const { messageId, ariaDescribedBy } = describedBy(fieldId, { error, helper }, rest['aria-describedby']);
  return (
    <FieldShell
      label={label}
      helper={helper}
      error={error}
      required={required}
      labelHint={labelHint}
      htmlFor={fieldId}
      messageId={messageId}
    >
      <input
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={controlClass(invalid, cx(INPUT_SIZES[size], className))}
      />
    </FieldShell>
  );
}

export type SelectSize = 'sm' | 'md' | 'lg';

const SELECT_SIZES: Record<SelectSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, FieldMeta {
  size?: SelectSize;
  /** 선택 컨트롤에 표시할 장식 아이콘. 기본값은 ChevronDown. */
  icon?: ReactNode;
  /** 아이콘 위치. 기본값은 오른쪽. */
  iconPosition?: 'left' | 'right';
}

export function Select({
  label,
  helper,
  error,
  required,
  labelHint,
  className,
  id,
  size = 'md',
  icon = <ChevronDown size={16} aria-hidden />,
  iconPosition = 'right',
  ...rest
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  const { messageId, ariaDescribedBy } = describedBy(fieldId, { error, helper }, rest['aria-describedby']);
  return (
    <FieldShell
      label={label}
      helper={helper}
      error={error}
      required={required}
      labelHint={labelHint}
      htmlFor={fieldId}
      messageId={messageId}
    >
      <div className='relative'>
        <select
          {...rest}
          id={fieldId}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          className={controlClass(
            invalid,
            cx(SELECT_SIZES[size], 'appearance-none', iconPosition === 'left' ? 'pl-9 pr-3.5' : 'pr-9', className),
          )}
        />
        <span
          className={cx(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted',
            iconPosition === 'left' ? 'left-3' : 'right-3',
          )}
        >
          {icon}
        </span>
      </div>
    </FieldShell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldMeta {
  /** true 이면 textarea 우하단에 현재 글자수 / maxLength 카운터를 표시한다. */
  showCount?: boolean;
}

export function Textarea({
  label,
  helper,
  error,
  required,
  labelHint,
  className,
  id,
  rows = 4,
  showCount,
  value,
  maxLength,
  onChange,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  const { messageId, ariaDescribedBy } = describedBy(fieldId, { error, helper }, rest['aria-describedby']);

  const controlled = value !== undefined;
  const [uncontrolledLen, setUncontrolledLen] = useState(() => {
    const init = rest.defaultValue;
    return typeof init === 'string' ? init.length : 0;
  });
  const charCount = controlled ? String(value).length : uncontrolledLen;
  const taRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!showCount) return;
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [charCount, showCount]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (!controlled) setUncontrolledLen(e.target.value.length);
    onChange?.(e);
  }

  return (
    <FieldShell
      label={label}
      helper={helper}
      error={error}
      required={required}
      labelHint={labelHint}
      htmlFor={fieldId}
      messageId={messageId}
    >
      {showCount ? (
        <div className='relative'>
          <textarea
            {...rest}
            ref={taRef}
            value={value}
            maxLength={maxLength}
            id={fieldId}
            rows={rows}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            onChange={handleChange}
            className={controlClass(invalid, cx('pt-2.5 pb-5 leading-relaxed resize-none overflow-hidden', className))}
          />
          <span
            aria-hidden
            className='pointer-events-none absolute bottom-[5px] left-[1px] right-[1px] flex items-center justify-end rounded-b-control bg-transparent px-3.5 py-1.5 text-[11px] tabular-nums text-fg-placeholder'
          >
            {charCount}
            {maxLength != null ? `/${maxLength}` : ''}
          </span>
        </div>
      ) : (
        <textarea
          {...rest}
          value={value}
          maxLength={maxLength}
          id={fieldId}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          onChange={onChange}
          className={controlClass(invalid, cx('py-2.5 leading-relaxed', className))}
        />
      )}
    </FieldShell>
  );
}
