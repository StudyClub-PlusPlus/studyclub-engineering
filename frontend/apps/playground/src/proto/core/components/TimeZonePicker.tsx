'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { Locale } from '@core/lib/content';
import { isValidZone } from '@core/lib/schedule-timezone';
import { availableZones, memberTimeZones, zoneLabel, zoneOffset, zoneSearchText } from '@core/lib/time-zones';
import { Button, Input } from '@studyclub/ui';
import { Check, ChevronDown } from 'lucide-react';

/** 회원·반·행사가 같은 검색 목록을 쓴다. 저장된 지역 ID와 별칭은 유지한다. */
export function zoneName(zone: string, locale: Locale): string | undefined {
  return isValidZone(zone) ? zoneLabel(zone, locale) : undefined;
}

export function TimeZonePicker({
  value, onChange, locale, disabled, error, hideLabel, label,
  compact = false, required = true, annotation = '3', prioritizeCountries = false, allowedZones, allowWorldwide = false,
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
  prioritizeCountries?: boolean;
  /** 기본 후보 목록. allowWorldwide가 없으면 이 목록 밖의 지역은 표시하지 않는다. */
  allowedZones?: readonly string[];
  /** 기본 후보에서 전체 지역 검색으로 확장. 기존 선택값은 기본 목록에도 보존한다. */
  allowWorldwide?: boolean;
}) {
  const ko = locale === 'ko';
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const [worldwide, setWorldwide] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const selected = zoneName(value, locale);
  const fieldLabel = label ?? (ko ? '나의 시간대' : 'My time zone');
  const zones = useMemo(() => {
    const candidates = allowWorldwide && worldwide ? undefined
      : allowWorldwide && allowedZones ? [...allowedZones, ...(isValidZone(value) ? [value] : [])] : allowedZones;
    return (prioritizeCountries ? memberTimeZones(value, locale, candidates) : (candidates ?? availableZones(value)))
      .map((zone) => ({ zone, search: zoneSearchText(zone) }));
  }, [value, locale, prioritizeCountries, allowedZones, allowWorldwide, worldwide]);
  const matches = useMemo(() => {
    const words = query.trim().replaceAll('_', ' ').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return zones.filter((item) => words.every((word) => item.search.includes(word)));
  }, [zones, query]);
  const groups = useMemo(() => {
    if (!prioritizeCountries) return [];
    const grouped = new Map<string, { item: typeof matches[number]; index: number; city: string }[]>();
    matches.forEach((item, index) => {
      const [country, ...city] = zoneLabel(item.zone, locale).split(' · ');
      const heading = city.length ? country : (ko ? '기타' : 'Other');
      const options = grouped.get(heading) ?? [];
      options.push({ item, index, city: city.length ? city.join(' · ') : country });
      grouped.set(heading, options);
    });
    return [...grouped.entries()];
  }, [matches, locale, ko, prioritizeCountries]);

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
      // 그룹 제목을 포함해 스크롤하되 방향키는 선택 가능한 도시만 이동한다.
      const heading = item.previousElementSibling;
      const target = heading?.hasAttribute('data-country-heading') ? heading : item;
      const top = target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
      const bottom = item.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }, [active, id, open, matches]);

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
    trigger.current?.focus();
  }

  function show() {
    setQuery('');
    setWorldwide(false);
    setActive(prioritizeCountries ? 0 : Math.max(0, zones.findIndex((item) => item.zone === value)));
    setOpen(true);
  }

  function renderOption(item: typeof matches[number], index: number, city?: string) {
    return (
      <button
        // ui-native: 시간대 검색 listbox의 option
        type='button'
        role='option'
        id={id + '-option-' + index}
        aria-selected={value === item.zone}
        aria-label={zoneLabel(item.zone, locale) + ' ' + zoneOffset(item.zone, now)}
        key={item.zone}
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActive(index)}
        onClick={() => select(item.zone)}
        className={'flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left type-label-lg hover:bg-brand-subtle ' + (active === index ? 'bg-brand-subtle' : '')}
      >
        <span className='min-w-0'>
          <span className='block font-semibold'>{city ?? zoneLabel(item.zone, locale)}</span>
          <span className='mt-0.5 block type-label-sm text-fg-muted'>{zoneOffset(item.zone, now)}</span>
        </span>
        {value === item.zone && <Check size={16} className='shrink-0 text-brand' aria-hidden='true' />}
      </button>
    );
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
        <span title={selected} className={(compact ? 'min-w-0 truncate ' : '') + (selected ? 'font-semibold text-fg' : 'text-fg-muted')}>
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
            {prioritizeCountries ? groups.map(([country, options]) => (
              <div key={country} role='group' aria-label={country}>
                <div data-country-heading className='bg-surface-2 px-3 py-1.5 type-label-sm font-semibold text-fg-muted'>{country}</div>
                {options.map(({ item, index, city }) => renderOption(item, index, city))}
              </div>
            )) : matches.map((item, index) => renderOption(item, index))}
          </div>
          {matches.length === 0 && <p role='status' className='px-3 py-2.5 type-label-sm text-fg-muted'>{ko ? '검색 결과가 없습니다.' : 'No time zones found.'}</p>}
          {allowWorldwide && <div className='mt-2 border-t border-border pt-2'>
            <Button size='sm' variant='tertiary' onClick={() => {
              setWorldwide(!worldwide);
              setActive(0);
              document.getElementById(id + '-search')?.focus();
            }}>
              {worldwide ? (ko ? '회원이 있는 시간대만 보기' : 'Show member time zones') : (ko ? '전체 시간대에서 찾기' : 'Search all time zones')}
            </Button>
          </div>}
        </div>
      )}
    </div>
  );
}

export { ZONES } from '@core/lib/zones';
