'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { Info } from 'lucide-react';

import type { regularScheduleDisplay } from '@/features/schedule/regular-schedule';

export function RegularTime({ summary }: { summary: ReturnType<typeof regularScheduleDisplay> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const helpId = useId();
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className='relative inline-block'>
      {summary.label}{' '}
      <button
        type='button'
        aria-label='스터디 시간 기준 안내'
        aria-expanded={open}
        aria-controls={helpId}
        onClick={() => setOpen((value) => !value)}
        className='inline-grid h-6 w-6 place-items-center rounded-full align-middle text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-brand'
      >
        <Info size={15} aria-hidden />
      </button>
      {open && (
        <span
          id={helpId}
          role='note'
          className='absolute -left-20 top-full z-30 mt-1.5 block w-80 max-w-[calc(100vw-6rem)] rounded-card border border-border bg-surface-raised p-3 text-left type-body-sm font-normal text-fg-secondary shadow-md sm:left-0'
        >
          <span className='block font-semibold text-fg'>반 기준: {summary.original}</span>
          <span className='mt-1 block'>서머타임에 따라 내 지역의 시간이 달라질 수 있어요.</span>
        </span>
      )}
    </span>
  );
}
