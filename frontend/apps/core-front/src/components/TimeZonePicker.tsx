'use client';

import { useEffect, useId, useRef, useState } from 'react';

import type { Locale } from '@/lib/content';
import { ONBOARDING_ZONES, zoneOffset } from '@/lib/onboarding';
import { Check, ChevronDown } from 'lucide-react';

const ZONES = [
  { zone: 'Asia/Seoul', ko: '한국 · 서울', en: 'Korea · Seoul' },
  {
    zone: 'America/New_York',
    ko: '북미 동부 · 뉴욕, 토론토',
    en: 'North America East · New York, Toronto',
  },
  {
    zone: 'America/Vancouver',
    ko: '북미 서부 · 밴쿠버',
    en: 'North America West · Vancouver',
  },
  {
    zone: 'America/Los_Angeles',
    ko: '북미 서부 · LA',
    en: 'North America West · LA',
  },
] as const;

function label(zone: string, locale: Locale): string | undefined {
  const found = ZONES.find((z) => z.zone === zone);
  return found ? (locale === 'ko' ? found.ko : found.en) : undefined;
}

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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const selected = label(value, locale);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className='relative'>
      <label htmlFor={`${id}-trigger`} className='text-sm font-medium text-neutral-800'>
        {ko ? '나의 시간대' : 'My time zone'}{' '}
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
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => {
          setActive(Math.max(0, ONBOARDING_ZONES.findIndex((z) => z === value)));
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((v) => Math.min(v + 1, ZONES.length - 1));
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((v) => Math.max(v - 1, 0));
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select(ZONES[active]!.zone);
          }
        }}
        className={`mt-1.5 flex min-h-12 w-full items-center justify-between gap-3 rounded-control border bg-bg px-3.5 py-2.5 text-left text-sm outline-none transition focus-visible:shadow-(--ring) disabled:cursor-not-allowed disabled:bg-surface-2 ${error ? 'border-error-600' : 'border-border-strong hover:border-brand'}`}
      >
        <span className={selected ? 'font-medium text-fg' : 'text-fg-muted'}>
          {selected ?? (ko ? '지역을 선택해 주세요' : 'Select your region')}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {error && (
        <p id={`${id}-error`} className='mt-2 text-xs leading-relaxed text-error-700'>
          {error}
        </p>
      )}
      {open && (
        <div
          id={`${id}-list`}
          role='listbox'
          aria-label={ko ? '지역' : 'Region'}
          className='absolute left-0 right-0 top-[76px] z-40 overflow-hidden rounded-card border border-border bg-bg p-1.5 shadow-lg'
        >
          {ZONES.map((z, index) => (
            <button
              type='button'
              role='option'
              aria-selected={value === z.zone}
              key={z.zone}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => select(z.zone)}
              className={`flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left text-sm hover:bg-brand-subtle ${
                active === index ? 'bg-brand-subtle' : ''
              }`}
            >
              <span className='min-w-0'>
                <span className='block font-medium'>{ko ? z.ko : z.en}</span>
                <span className='mt-0.5 block text-xs text-fg-muted'>{zoneOffset(z.zone, now)}</span>
              </span>
              {value === z.zone && <Check size={16} className='shrink-0 text-brand' aria-hidden='true' />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
