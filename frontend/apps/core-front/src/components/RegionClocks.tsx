'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Moon, Sun } from 'lucide-react';

import type { Locale } from '@/lib/content';
import { REGIONS, tzLabel } from '@/lib/regions';

function parts(tz: string, locale: Locale) {
  const loc = locale === 'ko' ? 'ko-KR' : 'en-US';
  const now = new Date();
  const time = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(now));
  const daytime = hour >= 7 && hour < 19;
  return { time, date, daytime, tz: tzLabel(tz, now) };
}

export function RegionClocks({ locale }: { locale: Locale }) {
  // SSR/CSR 시각 불일치(hydration) 방지: 마운트 전엔 placeholder.
  const [mounted, setMounted] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {REGIONS.map((r) => {
        const p = mounted ? parts(r.tz, locale) : null;
        return (
          <div key={r.id} className='card overflow-hidden p-0' style={{ borderTop: `3px solid ${r.color}` }}>
            <div className='flex items-center gap-3 px-5 pt-4'>
              <Image src={`/about-art/${r.art}.webp`} alt='' width={40} height={40} className='h-10 w-10' />
              <div className='min-w-0'>
                <div className='font-semibold' style={{ color: r.color }}>
                  {locale === 'ko' ? r.name.ko : r.name.en}
                </div>
                <div className='text-xs text-[var(--color-fg-muted)]'>{locale === 'ko' ? r.city.ko : r.city.en}</div>
                {/* 시간대 — 약어(PDT·EST 등)와 UTC 차이. 서머타임에 따라 바뀌어 마운트 뒤에만 그린다 */}
                <div className='mt-0.5 text-[11px] font-semibold tabular-nums' style={{ color: r.color }} suppressHydrationWarning>
                  {p ? [p.tz.abbr, p.tz.offset].filter(Boolean).join(' · ') : ' '}
                </div>
              </div>
              <span className='ml-auto' aria-hidden='true'>
                {p ? p.daytime ? <Sun size={18} style={{ color: 'var(--color-warning-600)' }} /> : <Moon size={18} style={{ color: 'var(--color-brand)' }} /> : null}
              </span>
            </div>
            <div className='mt-2 px-5 pb-4' style={{ background: r.soft }}>
              <div
                className='pt-3 font-mono text-3xl font-bold tabular-nums tracking-tight'
                style={{ color: r.color }}
                suppressHydrationWarning
              >
                {p ? p.time : '--:--:--'}
              </div>
              <div className='mt-0.5 text-xs text-[var(--color-fg-muted)]' suppressHydrationWarning>
                {p ? p.date : ' '}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
