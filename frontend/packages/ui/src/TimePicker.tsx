'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Clock } from 'lucide-react';

import { IconButton } from './Button';
import { cx } from './cx';
import { Input } from './Field';
import type { InputProps } from './Field';
import { POPOVER_PANEL, useAnchoredPopover } from './popover';

type PickerLocale = 'ko' | 'en';

const TEXT = {
  ko: { open: '시각 목록 열기', dialog: '시각 고르기', hour: '시', minute: '분' },
  en: { open: 'Open time list', dialog: 'Choose a time', hour: 'Hour', minute: 'Minute' },
} as const;

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));
const VALID = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 숫자 4자리(2030)는 HH:mm 으로 맞춘다. */
function normalize(text: string) {
  const trimmed = text.trim();
  return /^\d{4}$/.test(trimmed) ? `${trimmed.slice(0, 2)}:${trimmed.slice(2)}` : trimmed;
}

/**
 * design-system.md §9-2 Time Picker — 칸에 HH:mm 을 바로 치거나, 오른쪽 시계 단추로 시 · 분 목록에서 고른다.
 * 값은 `HH:mm`(24시간) 또는 `''`. 시를 고르면 창이 남아 분으로 넘어가고, 분을 고르면 닫힌다.
 */
export interface TimePickerProps extends Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'size' | 'trailing' | 'suffix' | 'leadingIcon' | 'defaultValue' | 'min' | 'max'
> {
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  minuteStep?: number;
  locale?: PickerLocale;
}

export function TimePicker({
  value,
  onChange,
  size = 'md',
  minuteStep = 5,
  locale = 'ko',
  label,
  disabled,
  onBlur,
  onKeyDown,
  'aria-label': ariaLabel,
  ...rest
}: TimePickerProps) {
  const t = TEXT[locale];
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState<'hour' | 'minute'>('hour');
  const [focused, setFocused] = useState('');
  const focusItem = useRef(false);

  useEffect(() => setDraft(value), [value]);

  const close = useCallback(() => setOpen(false), []);
  useAnchoredPopover({ open, onClose: close, rootRef, anchorRef: buttonRef, panelRef, align: 'end' });

  const [hour = '', minute = ''] = VALID.test(value) ? value.split(':') : [];
  const steps = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep));
  const minutes = minute && !steps.includes(minute) ? [...steps, minute].sort() : steps;
  const items = column === 'hour' ? HOURS : minutes;

  useEffect(() => {
    if (!open) return;
    // 처음 열 때 두 목록 모두 고른 값이 가운데 오게 굴린다. scrollIntoView 는 바깥 화면까지 굴려서 쓰지 않는다.
    panelRef.current?.querySelectorAll<HTMLElement>('[role="listbox"]').forEach((list) => {
      const chosen = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (chosen) list.scrollTop = chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2;
    });
  }, [open]);

  useEffect(() => {
    if (!open || !focusItem.current) return;
    focusItem.current = false;
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-${column}="${focused}"]`)?.focus();
  }, [open, column, focused]);

  function show() {
    focusItem.current = true;
    setColumn('hour');
    setFocused(hour || '09');
    setOpen(true);
  }

  function pickHour(h: string) {
    onChange(`${h}:${minute || '00'}`);
    focusItem.current = true;
    setColumn('minute');
    setFocused(minute || '00');
  }

  function pickMinute(m: string) {
    onChange(`${hour || '00'}:${m}`);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onListKey(event: KeyboardEvent) {
    const index = items.indexOf(focused);
    const next: Record<string, () => void> = {
      ArrowDown: () => setFocused(items[Math.min(index + 1, items.length - 1)]!),
      ArrowUp: () => setFocused(items[Math.max(index - 1, 0)]!),
      Home: () => setFocused(items[0]!),
      End: () => setFocused(items[items.length - 1]!),
      ArrowRight: () => {
        setColumn('minute');
        setFocused(minute || '00');
      },
      ArrowLeft: () => {
        setColumn('hour');
        setFocused(hour || '09');
      },
    };
    const run = next[event.key];
    if (!run) return;
    event.preventDefault();
    focusItem.current = true;
    run();
  }

  const name = label ?? ariaLabel ?? (locale === 'ko' ? '시각' : 'Time');
  // 두 목록 모두 Tab 으로 들어갈 자리를 하나씩 둔다 — 지금 값, 없으면 첫 칸.
  const tabStop = { hour: hour || HOURS[0]!, minute: minute || minutes[0]! };
  const option = (kind: 'hour' | 'minute', v: string, selected: boolean) => (
    <button
      key={v}
      type='button'
      role='option'
      aria-selected={selected}
      {...{ [`data-${kind}`]: v }}
      tabIndex={v === (column === kind ? focused : tabStop[kind]) ? 0 : -1}
      onFocus={() => {
        setColumn(kind);
        setFocused(v);
      }}
      onClick={() => (kind === 'hour' ? pickHour(v) : pickMinute(v))}
      className={cx(
        'tnum block h-8 w-full shrink-0 rounded-control type-label-lg transition-colors duration-fast ease-out',
        'focus-visible:outline-none focus-visible:shadow-(--ring)',
        selected ? 'bg-brand font-semibold text-on-brand hover:bg-brand-hover' : 'text-ink hover:bg-primary-light',
      )}
    >
      {v}
    </button>
  );

  return (
    <div ref={rootRef}>
      <Input
        {...rest}
        ref={inputRef}
        label={label}
        aria-label={ariaLabel}
        disabled={disabled}
        size={size}
        inputMode='numeric'
        autoComplete='off'
        placeholder='HH:mm'
        maxLength={5}
        value={draft}
        onChange={(event) => {
          const text = normalize(event.target.value);
          setDraft(text);
          if (text === '' || VALID.test(text)) onChange(text);
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
              icon={<Clock />}
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
                className={cx(POPOVER_PANEL, 'flex w-40 gap-1')}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {(['hour', 'minute'] as const).map((kind) => (
                  <div key={kind} className='flex min-w-0 flex-1 flex-col'>
                    <p className='px-1 pb-1 text-center type-label-sm text-fg-muted'>{t[kind]}</p>
                    <div
                      role='listbox'
                      aria-label={`${name} ${t[kind]}`}
                      onKeyDown={onListKey}
                      className='relative flex max-h-56 flex-col gap-0.5 overflow-y-auto p-0.5'
                    >
                      {kind === 'hour'
                        ? HOURS.map((h) => option('hour', h, h === hour))
                        : minutes.map((m) => option('minute', m, m === minute))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
