'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cx } from './cx';

/** design-system.md §9-2 — 입력 계열 공통 셸. */
const CONTROL_BASE = cx(
  'w-full rounded-control border bg-bg px-3.5 text-sm text-neutral-900',
  'placeholder:text-fg-placeholder',
  'transition-[border-color,box-shadow] duration-fast ease-out',
  'focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-neutral-400',
);

const CONTROL_OK = 'border-border-strong focus:border-brand focus:shadow-(--ring)';
const CONTROL_ERROR = 'border-error-600 focus:border-error-600 focus:shadow-(--ring-error)';

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
  children: ReactNode;
}

/** 라벨 + 컨트롤 + helper/error 를 묶는다. error 가 있으면 helper 대신 error 를 보여준다. */
export function FieldShell({ label, helper, error, required, labelHint, htmlFor, children }: FieldShellProps) {
  const message = error ?? helper;
  return (
    <div className='flex flex-col gap-1.5'>
      {(label || labelHint) && (
        <div className='flex items-baseline justify-between gap-2'>
          <label htmlFor={htmlFor} className='text-sm font-medium text-neutral-800'>
            {label}
            {required && (
              <span className='ml-0.5 text-error-600' aria-hidden='true'>
                *
              </span>
            )}
          </label>
          {labelHint && <span className='shrink-0 text-xs text-fg-placeholder'>{labelHint}</span>}
        </div>
      )}
      {children}
      {message && <p className={cx('text-xs', error ? 'text-error-700' : 'text-fg-muted')}>{message}</p>}
    </div>
  );
}

type FieldMeta = Pick<FieldShellProps, 'label' | 'helper' | 'error' | 'required' | 'labelHint'>;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldMeta {}

export function Input({ label, helper, error, required, labelHint, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} labelHint={labelHint} htmlFor={fieldId}>
      <input
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={invalid || undefined}
        className={controlClass(invalid, cx('h-10', className))}
      />
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldMeta {}

export function Select({ label, helper, error, required, labelHint, className, id, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} labelHint={labelHint} htmlFor={fieldId}>
      <select
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={invalid || undefined}
        className={controlClass(invalid, cx('h-10', className))}
      />
    </FieldShell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldMeta {}

export function Textarea({
  label,
  helper,
  error,
  required,
  labelHint,
  className,
  id,
  rows = 4,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} labelHint={labelHint} htmlFor={fieldId}>
      <textarea
        {...rest}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={invalid || undefined}
        className={controlClass(invalid, cx('py-2.5 leading-relaxed', className))}
      />
    </FieldShell>
  );
}
