'use client';

import { useState, type ReactNode } from 'react';

import { cx } from './cx';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: 'sm' | 'md';
  shape?: 'rounded' | 'pill';
  fullWidth?: boolean;
  className?: string;
}

/**
 * design-system.md §9-8 Segmented Control.
 *
 * - track: surface-2
 * - active: 흰 bg(bg-bg) + shadow-xs
 * - inactive: neutral-600 (hover: neutral-900)
 */
export function Segmented<T extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  size = 'md',
  shape = 'rounded',
  fullWidth = false,
  className,
}: SegmentedProps<T>) {
  const [internalValue, setInternalValue] = useState<T>(defaultValue ?? options[0]?.value as T);
  const currentValue = value !== undefined ? value : internalValue;

  function handleClick(optValue: T, disabled?: boolean) {
    if (disabled) return;
    if (value === undefined) {
      setInternalValue(optValue);
    }
    onChange?.(optValue);
  }

  const trackRadius = shape === 'pill' ? 'rounded-pill' : 'rounded-control';
  const itemRadius = shape === 'pill' ? 'rounded-pill' : 'rounded-control';
  const itemPadding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm';

  return (
    <div
      role='tablist'
      className={cx(
        'inline-flex items-center gap-1 bg-surface-2 p-1',
        trackRadius,
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === currentValue;

        return (
          <button
            key={opt.value}
            role='tab'
            type='button'
            disabled={opt.disabled}
            aria-selected={active}
            onClick={() => handleClick(opt.value, opt.disabled)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-fast focus-visible:outline-none focus-visible:shadow-(--ring)',
              itemRadius,
              itemPadding,
              fullWidth && 'flex-1',
              active
                ? 'bg-bg font-semibold text-neutral-900 shadow-xs'
                : 'text-fg-muted hover:text-fg',
              opt.disabled && 'cursor-not-allowed opacity-40 hover:text-fg-muted',
            )}
          >
            {opt.icon && <span className='shrink-0'>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
