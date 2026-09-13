'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { Locale } from '@core/lib/content';
import { availableZones, localTime, POPULAR_ZONES, zoneLabel, zoneOffset, zoneSearchText } from '@core/lib/time-zones';
import { Check, ChevronDown, Clock3, Search } from 'lucide-react';

export function TimeZonePicker({
  value,
  onChange,
  locale,
  disabled,
  error,
}: {
  value: string;
  onChange: (zone: string) => void;
  locale: Locale;
  disabled?: boolean;
  error?: string;
}) {
  const ko = locale === 'ko';
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const zones = useMemo(() => availableZones(value), [value]);
  const filtered = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().replaceAll('_', ' ').split(/\s+/);
    return zones.filter((zone) => words.every((word) => zoneSearchText(zone).includes(word)));
  }, [zones, query]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className='relative' data-anno='3'>
      <label htmlFor={`${id}-trigger`} className='text-sm font-medium text-neutral-800'>
        {ko ? '일정에 사용할 시간대' : 'Your time zone'}{' '}
        <span className='text-error-600' aria-hidden='true'>
          *
        </span>
      </label>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type='button'
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help`}
        onClick={() => {
          setQuery('');
          setActive(0);
          setOpen((v) => !v);
        }}
        className={`mt-1.5 flex min-h-12 w-full items-center justify-between gap-3 rounded-control border bg-bg px-3.5 py-2.5 text-left text-sm outline-none transition focus-visible:shadow-(--ring) disabled:cursor-not-allowed disabled:bg-surface-2 ${error ? 'border-error-600' : 'border-border-strong hover:border-brand'}`}
      >
        <span className={value ? 'font-medium text-fg' : 'text-fg-muted'}>
          {value ? zoneLabel(value, locale) : ko ? '시간대를 선택해 주세요' : 'Select a time zone'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <p id={`${id}-help`} className={`mt-2 text-xs leading-relaxed ${error ? 'text-error-700' : 'text-fg-muted'}`}>
        {error ??
          (ko
            ? '기기 설정을 먼저 선택해요. 다른 지역으로 변경할 수 있어요.'
            : 'Suggested from your device. You can choose a different region.')}
      </p>
      {value && (
        <p className='mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted' data-anno='3-1'>
          <Clock3 size={13} aria-hidden='true' />
          <span>
            {ko ? '현재 시각' : 'Current time'} · {localTime(value, locale, now)}
          </span>
        </p>
      )}
      {open && (
        <div className='absolute left-0 right-0 top-[76px] z-40 overflow-hidden rounded-card border border-border bg-bg shadow-lg'>
          <div className='flex items-center gap-2 border-b border-border px-3.5 py-3'>
            <Search size={16} className='shrink-0 text-fg-muted' aria-hidden='true' />
            <input
              ref={input}
              role='combobox'
              aria-label={ko ? '도시 또는 시간대 검색' : 'Search city or time zone'}
              aria-autocomplete='list'
              aria-expanded='true'
              aria-controls={`${id}-list`}
              aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined}
              placeholder={ko ? '도시 또는 시간대 검색' : 'Search city or time zone'}
              value={query}
              className='min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-muted'
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                  trigger.current?.focus();
                }
                if (event.key === 'Tab') setOpen(false);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActive((v) => Math.min(v + 1, filtered.length - 1));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((v) => Math.max(v - 1, 0));
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (filtered[active]) select(filtered[active]);
                }
              }}
            />
          </div>
          {!query && (
            <p className='px-3.5 pb-1 pt-3 text-xs font-medium text-fg-muted'>
              {ko ? '자주 사용하는 시간대부터 표시해요' : 'Popular time zones first'}
            </p>
          )}
          <div
            id={`${id}-list`}
            role='listbox'
            aria-label={ko ? '시간대' : 'Time zones'}
            className='max-h-60 overflow-y-auto overscroll-contain p-1.5'
          >
            {filtered.map((zone, index) => (
              <button
                type='button'
                role='option'
                aria-selected={value === zone}
                id={`${id}-option-${index}`}
                key={zone}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(zone)}
                className={`flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left text-sm hover:bg-brand-subtle ${active === index ? 'bg-brand-subtle' : ''} ${!query && index === POPULAR_ZONES.length ? 'mt-1 border-t border-border' : ''}`}
              >
                <span className='min-w-0'>
                  <span className='block font-medium'>{zoneLabel(zone, locale)}</span>
                  <span className='mt-0.5 block text-xs text-fg-muted'>{zoneOffset(zone, now)}</span>
                </span>
                {value === zone && <Check size={16} className='shrink-0 text-brand' aria-hidden='true' />}
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p role='status' className='px-4 py-6 text-sm text-fg-muted'>
              {ko
                ? '검색 결과가 없어요. 다른 국가나 도시 이름으로 찾아보세요.'
                : 'No time zones found. Try another city or its English name.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
