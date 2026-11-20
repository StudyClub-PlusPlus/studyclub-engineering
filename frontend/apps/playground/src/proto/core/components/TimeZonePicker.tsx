'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { Locale } from '@core/lib/content';
import { isValidZone } from '@core/lib/schedule-timezone';
import { availableZones, zoneLabel, zoneOffset, zoneSearchText } from '@core/lib/time-zones';
import { Input } from '@studyclub/ui';
import { Check, ChevronDown } from 'lucide-react';

/** 회원·반·행사가 같은 검색 목록을 쓴다. 저장된 지역 ID와 별칭은 유지한다. */
export function zoneName(zone: string, locale: Locale): string | undefined {
  return isValidZone(zone) ? zoneLabel(zone, locale) : undefined;
}

export function TimeZonePicker({
  value, onChange, locale, disabled, error, hideLabel, label,
  compact = false, required = true, annotation = '3',
}: {
  value: string;
  onChange: (zone: string) => void;
  locale: Locale;
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
  label?: string;
  compact?: boolean;
  required?: boolean;
  annotation?: string | false;
}) {
  const ko = locale === 'ko';
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const selected = zoneName(value, locale);
  const fieldLabel = label ?? (ko ? '나의 시간대' : 'My time zone');
  const zones = useMemo(() => availableZones(value).map((zone) => ({ zone, search: zoneSearchText(zone) })), [value]);
  const matches = useMemo(() => {
    const words = query.trim().replaceAll('_', ' ').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return zones.filter((item) => words.every((word) => item.search.includes(word)));
  }, [zones, query]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.getElementById(id + '-search')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    const list = document.getElementById(id + '-list');
    const item = document.getElementById(id + '-option-' + active);
    if (list && item) {
      const top = item.offsetTop - list.offsetTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + item.offsetHeight - list.clientHeight;
    }
  }, [active, id, open]);

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
    trigger.current?.focus();
  }

  function show() {
    setQuery('');
    setActive(Math.max(0, zones.findIndex((item) => item.zone === value)));
    setOpen(true);
  }

  return (
    <div ref={root} className='relative' data-anno={annotation || undefined}>
      {!hideLabel && (
        <label htmlFor={id + '-trigger'} className='type-label-lg text-neutral-800'>
          {fieldLabel}{' '}
          {required && <span className='text-error-600' aria-hidden='true'>*</span>}
        </label>
      )}
      <button
        // ui-native: 시간대 검색 listbox를 여는 도메인 선택기
        ref={trigger}
        id={id + '-trigger'}
        type='button'
        disabled={disabled}
        aria-label={fieldLabel + ': ' + (selected ?? (ko ? '선택 안 함' : 'Not selected'))}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={id + '-list'}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
          }
        }}
        className={(hideLabel ? '' : 'mt-1.5 ') + 'flex ' + (compact ? 'min-h-10' : 'min-h-12') + ' w-full items-center justify-between gap-3 rounded-control border bg-bg px-3.5 py-2.5 text-left type-label-lg outline-none transition focus-visible:shadow-(--ring) disabled:cursor-not-allowed disabled:bg-surface-2 ' + (error ? 'border-error-600' : 'border-border-strong hover:border-brand')}
      >
        <span className={selected ? 'font-semibold text-fg' : 'text-fg-muted'}>
          {selected ?? (ko ? '시간대를 선택해 주세요' : 'Select a time zone')}
        </span>
        <ChevronDown size={16} className={'shrink-0 text-fg-muted transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {error && <p id={id + '-error'} className='mt-2 type-label-sm text-error-700'>{error}</p>}
      {open && (
        <div
          className='absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-card border border-border bg-bg p-1.5 shadow-lg'
          onBlur={(event) => {
            if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <div className='p-1.5'>
            <Input
              id={id + '-search'}
              size='sm'
              role='combobox'
              aria-label={ko ? '시간대 검색' : 'Search time zones'}
              aria-expanded={open}
              aria-controls={id + '-list'}
              aria-autocomplete='list'
              aria-activedescendant={matches[active] ? id + '-option-' + active : undefined}
              placeholder={ko ? '도시 또는 국가 검색' : 'Search city or country'}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
                if (event.key === 'ArrowDown') { event.preventDefault(); setActive((v) => Math.min(v + 1, Math.max(0, matches.length - 1))); }
                if (event.key === 'ArrowUp') { event.preventDefault(); setActive((v) => Math.max(v - 1, 0)); }
                if (event.key === 'Enter') { event.preventDefault(); if (matches[active]) select(matches[active].zone); }
              }}
            />
          </div>
          <div id={id + '-list'} role='listbox' aria-label={fieldLabel} className='max-h-64 overflow-y-auto'>
            {matches.map((item, index) => (
              <button
                // ui-native: 시간대 검색 listbox의 option
                type='button'
                role='option'
                id={id + '-option-' + index}
                aria-selected={value === item.zone}
                key={item.zone}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(item.zone)}
                className={'flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left type-label-lg hover:bg-brand-subtle ' + (active === index ? 'bg-brand-subtle' : '')}
              >
                <span className='min-w-0'>
                  <span className='block font-semibold'>{zoneLabel(item.zone, locale)}</span>
                  <span className='mt-0.5 block type-label-sm text-fg-muted'>{zoneOffset(item.zone, now)}</span>
                </span>
                {value === item.zone && <Check size={16} className='shrink-0 text-brand' aria-hidden='true' />}
              </button>
            ))}
          </div>
          {matches.length === 0 && <p role='status' className='px-3 py-2.5 type-label-sm text-fg-muted'>{ko ? '검색 결과가 없습니다.' : 'No time zones found.'}</p>}
        </div>
      )}
    </div>
  );
}

export { ZONES } from '@core/lib/zones';
