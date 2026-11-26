'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button, IconButton } from './Button';
import { cx } from './cx';
import { Input } from './Field';
import type { InputProps } from './Field';
import { POPOVER_PANEL, useAnchoredPopover } from './popover';

type PickerLocale = 'ko' | 'en';

const TEXT = {
  ko: { open: '달력 열기', dialog: '날짜 고르기', prev: '이전 달', next: '다음 달', today: '오늘', clear: '지우기' },
  en: {
    open: 'Open calendar',
    dialog: 'Choose a date',
    prev: 'Previous month',
    next: 'Next month',
    today: 'Today',
    clear: 'Clear',
  },
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** 달력 계산은 UTC 자정 Date 로 한다 — 기기 시간대의 서머타임 경계에서 하루가 밀리지 않는다. */
function parse(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCMonth() === Number(m[2]) - 1 ? date : undefined;
}

function iso(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(value: string, days: number) {
  const date = parse(value)!;
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

/** 31일에서 한 달 넘기면 다음 달 말일에 선다. */
function addMonths(value: string, months: number) {
  const date = parse(value)!;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return iso(date);
}

function deviceToday() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 일요일부터 6주(42칸). 앞뒤 달 날짜로 채운다. */
function monthGrid(focused: string) {
  const first = parse(`${focused.slice(0, 7)}-01`)!;
  const start = addDays(iso(first), -first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** 숫자 8자리(20261123)는 YYYY-MM-DD 로 맞춘다. */
function normalize(text: string) {
  const digits = text.trim();
  return /^\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : digits;
}

/**
 * design-system.md §9-2 Date Picker — 칸에 YYYY-MM-DD 를 바로 치거나, 오른쪽 달력 단추로 고른다.
 * 값은 `YYYY-MM-DD` 또는 `''`. 다 치기 전 글자는 칸에만 남고, 칸을 떠나면 마지막 값으로 돌아간다.
 */
export interface DatePickerProps extends Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'min' | 'max' | 'size' | 'trailing' | 'suffix' | 'leadingIcon' | 'defaultValue'
> {
  value: string;
  onChange: (value: string) => void;
  /** 고를 수 있는 첫날 · 마지막 날(`YYYY-MM-DD`). 달력에서 밖의 날은 막힌다. */
  min?: string;
  max?: string;
  size?: 'sm' | 'md';
  locale?: PickerLocale;
  /** 「오늘」 표시 기준. 기본은 기기 날짜 — 프로필 시간대의 오늘을 쓰는 화면은 넘긴다. */
  today?: string;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  size = 'md',
  locale = 'ko',
  today: todayProp,
  label,
  required,
  disabled,
  onBlur,
  onKeyDown,
  'aria-label': ariaLabel,
  ...rest
}: DatePickerProps) {
  const t = TEXT[locale];
  const intl = locale === 'ko' ? 'ko-KR' : 'en-US';
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value);
  const today = todayProp ?? deviceToday();
  // 키보드로 옮길 때만 날짜 칸으로 포커스를 보낸다 — 이전 · 다음 달 단추를 누른 사람은 단추에 남는다.
  const focusDay = useRef(false);

  useEffect(() => setDraft(value), [value]);

  const close = useCallback(() => setOpen(false), []);
  useAnchoredPopover({ open, onClose: close, rootRef, anchorRef: buttonRef, panelRef, align: 'end' });

  const blocked = (date: string) => Boolean((min && date < min) || (max && date > max));
  const clamp = (date: string) => (min && date < min ? min : max && date > max ? max : date);

  useEffect(() => {
    if (!open || !focusDay.current) return;
    focusDay.current = false;
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  function show() {
    focusDay.current = true;
    setFocused(clamp(parse(value) ? value : today));
    setOpen(true);
  }

  function choose(date: string) {
    onChange(date);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onGridKey(event: KeyboardEvent) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -parse(focused)!.getUTCDay()),
      End: () => addDays(focused, 6 - parse(focused)!.getUTCDay()),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusDay.current = true;
    setFocused(clamp(move()));
  }

  const name = label ?? ariaLabel ?? (locale === 'ko' ? '날짜' : 'Date');
  const month = focused.slice(0, 7);
  const days = open ? monthGrid(focused) : [];
  const monthTitle = open
    ? new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(parse(focused))
    : '';
  const dayName = new Intl.DateTimeFormat(intl, { dateStyle: 'full', timeZone: 'UTC' });
  const weekdayName = new Intl.DateTimeFormat(intl, { weekday: locale === 'ko' ? 'narrow' : 'short', timeZone: 'UTC' });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayName.format(new Date(Date.UTC(2023, 0, 1 + i))));

  return (
    <div ref={rootRef}>
      <Input
        {...rest}
        ref={inputRef}
        label={label}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        size={size}
        inputMode='numeric'
        autoComplete='off'
        placeholder='YYYY-MM-DD'
        maxLength={10}
        value={draft}
        onChange={(event) => {
          const text = normalize(event.target.value);
          setDraft(text);
          if (text === '' || parse(text)) onChange(text);
        }}
        onBlur={(event) => {
          setDraft(value);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && event.altKey) {
            event.preventDefault();
            show();
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
          onKeyDown?.(event);
        }}
        className={cx('tnum', rest.className)}
        trailing={
          <>
            <IconButton
              ref={buttonRef}
              variant='tertiary'
              size='xs'
              icon={<CalendarDays />}
              aria-label={`${name} ${t.open}`}
              aria-haspopup='dialog'
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              disabled={disabled}
              onClick={() => (open ? setOpen(false) : show())}
              className='absolute top-1/2 right-1.5 -translate-y-1/2'
            />
            {open && (
              <div
                ref={panelRef}
                id={panelId}
                role='dialog'
                aria-label={`${name} ${t.dialog}`}
                className={cx(POPOVER_PANEL, 'w-80 px-4 py-3')}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <div className='flex items-center justify-between gap-2 px-1 pb-2'>
                  <IconButton
                    variant='tertiary'
                    size='sm'
                    icon={<ChevronLeft />}
                    aria-label={t.prev}
                    onClick={() => setFocused(clamp(addMonths(focused, -1)))}
                  />
                  <p aria-live='polite' className='type-label-lg font-semibold text-ink'>
                    {monthTitle}
                  </p>
                  <IconButton
                    variant='tertiary'
                    size='sm'
                    icon={<ChevronRight />}
                    aria-label={t.next}
                    onClick={() => setFocused(clamp(addMonths(focused, 1)))}
                  />
                </div>
                <table role='grid' aria-label={monthTitle} className='w-full border-collapse' onKeyDown={onGridKey}>
                  <thead>
                    <tr>
                      {weekdays.map((w) => (
                        <th key={w} scope='col' className='h-8 type-label-sm font-medium text-fg-muted'>
                          {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, row) => (
                      <tr key={row}>
                        {days.slice(row * 7, row * 7 + 7).map((date) => {
                          const selected = date === value;
                          const off = blocked(date);
                          return (
                            <td key={date} role='gridcell' aria-selected={selected} className='p-0.5 text-center'>
                              <button
                                type='button'
                                data-date={date}
                                tabIndex={date === focused ? 0 : -1}
                                disabled={off}
                                aria-label={dayName.format(parse(date))}
                                aria-current={date === today ? 'date' : undefined}
                                onClick={() => choose(date)}
                                className={cx(
                                  'tnum mx-auto grid h-9 w-9 place-items-center rounded-control border border-transparent type-label-lg',
                                  'transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:shadow-(--ring)',
                                  date.slice(0, 7) === month ? 'text-ink' : 'text-fg-placeholder',
                                  date === today && !selected && 'border-border-strong font-semibold',
                                  selected
                                    ? 'bg-brand font-semibold text-on-brand hover:bg-brand-hover'
                                    : 'hover:bg-primary-light',
                                  off && 'cursor-not-allowed text-neutral-400 hover:bg-transparent',
                                )}
                              >
                                {Number(date.slice(8))}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className='mt-1 flex items-center justify-between border-t border-border px-1 pt-2'>
                  <Button
                    variant='tertiary'
                    size='sm'
                    className='min-w-0'
                    disabled={blocked(today)}
                    onClick={() => choose(today)}
                  >
                    {t.today}
                  </Button>
                  {!required && value && (
                    <Button variant='tertiary' size='sm' className='min-w-0' onClick={() => choose('')}>
                      {t.clear}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
